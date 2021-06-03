const { ServiceBroker } = require('moleculer');
const urlJoin = require('url-join');
const mailer = require('nodemailer');
const fetch = require('node-fetch');
const { MIME_TYPES } = require('@semapps/mime-types');
const EventsWatcher = require('./EventsWatcher');
const path = require('path');
const CONFIG = require('../config');

jest.setTimeout(30000);

const broker = new ServiceBroker({
  middlewares: [EventsWatcher],
  logger: false
});

beforeAll(async () => {
  await fetch(CONFIG.SPARQL_ENDPOINT + CONFIG.MAIN_DATASET + '/update', {
    method: 'POST',
    body: 'update=DROP+ALL',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(CONFIG.JENA_USER + ':' + CONFIG.JENA_PASSWORD).toString('base64')
    }
  });
  await broker.loadServices(path.resolve(__dirname, '../services'));
  await broker.start();
});

afterAll(async () => {
  await broker.stop();
});

describe('Test match-bot service', () => {
  let actors = [];
  const matchBotUri = 'http://localhost:4000/actors/match-bot';

  test('Create 3 actors and make them follow the match bot', async () => {
    let actorUri;
    for (let i = 1; i <= 3; i++) {
      actorUri = await broker.call('ldp.resource.post', {
        containerUri: 'http://localhost:4000/actors/',
        resource: require(`./actors/actor${i}.json`),
        contentType: MIME_TYPES.JSON
      });

      actors[i] = await broker.call('activitypub.actor.awaitCreateComplete', { actorUri });

      await broker.call(
        'activitypub.outbox.post',
        {
          collectionUri: actors[i].outbox,
          '@context': 'https://www.w3.org/ns/activitystreams',
          actor: actors[i].id,
          type: 'Follow',
          object: matchBotUri,
          to: [actors[i].followers, matchBotUri]
        },
        { meta: { webId: actors[i].id } }
      );

      const followEvent = await broker.watchForEvent('activitypub.follow.added');

      expect(followEvent.follower).toBe(actors[i].id);
    }
  });

  test('Post project 1 and announce it to actor 3', async () => {
    await broker.call(
      'activitypub.inbox.post',
      {
          collectionUri: urlJoin(matchBotUri, 'inbox'),
          ...require('./projects/project1.json')
      },
      { meta: { skipSignatureValidation: true }}
    );

    await broker.watchForEvent('mailer.objects.queued');

    // Actor 3 should match with this project
    const inbox = await broker.call('activitypub.inbox.list', {
      collectionUri: matchBotUri + '/outbox',
      page: 1
    });

    expect(inbox.orderedItems).not.toBeNull();
    expect(inbox.orderedItems[0]).toMatchObject({
      type: 'Announce',
      actor: matchBotUri,
      object: "http://localhost:3000/projects/hameau-des-buis-ecole-la-ferme-des-enfants",
      to: [actors[3].id, 'as:Public']
    });
  });

  test('Post project 2 and announce it to actors 1 and 3', async () => {
    await broker.call(
      'activitypub.inbox.post',
      {
        collectionUri: urlJoin(matchBotUri, 'inbox'),
        ...require('./projects/project2.json')
      },
      { meta: { skipSignatureValidation: true }}
    );

    await broker.watchForEvent('mailer.objects.queued');

    // Actors 1 and 3 should match
    const outbox = await broker.call('activitypub.inbox.list', {
      collectionUri: matchBotUri + '/outbox',
      page: 1
    });

    expect(outbox.orderedItems).not.toBeNull();
    expect(outbox.orderedItems[0]).toMatchObject({
      type: 'Announce',
      actor: matchBotUri,
      object: 'http://localhost:3000/projects/chateau-darvieu',
      to: [actors[3].id, actors[1].id, 'as:Public']
    });
  });

  test('Process queue with daily frequency', async () => {
    const job = await broker.call('mailer.processNotifications', { frequency: 'daily' });

    const result = await job.finished();

    expect(result).toMatchObject({
      [actors[3].id]: ['http://localhost:3000/projects/hameau-des-buis-ecole-la-ferme-des-enfants', 'http://localhost:3000/projects/chateau-darvieu']
    });
  });

  test('Process queue with weekly frequency', async () => {
    const job = await broker.call('mailer.processNotifications', { frequency: 'weekly' });

    const result = await job.finished();

    expect(result).toMatchObject({
      [actors[1].id]: ['http://localhost:3000/projects/chateau-darvieu']
    });
  });

  test('Send confirmation mail', async () => {
    const job = await broker.call('mailer.sendConfirmationMail', { actor: actors[1] });

    const result = await job.finished();

    const previewUrl = mailer.getTestMessageUrl(result);
    console.log('CONFIRMATION MAIL PREVIEW', previewUrl);

    expect(result).not.toBeNull();
    expect(result.accepted[0]).toBe('sebastien@test.com');
  });

  test('Send notification mail', async () => {
    const job = await broker.call('mailer.sendNotificationMail', {
      actorUri: actors[3].id,
      objects: ['http://localhost:3000/projects/hameau-des-buis-ecole-la-ferme-des-enfants', 'http://localhost:3000/projects/chateau-darvieu']
    });

    const result = await job.finished();

    const previewUrl = mailer.getTestMessageUrl(result);
    console.log('NOTIFICATION MAIL PREVIEW', previewUrl);

    expect(result).not.toBeNull();
    expect(result.accepted[0]).toBe('loic@test.com');
  });
});
