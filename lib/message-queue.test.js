const MessageQueue = require('./message-queue');
const {MongoClient} = require('mongodb');
const {buildTest, tryBest} = require('../test-utils');
const lolex = require('lolex');

const test = buildTest(setUp);

describe('Message Queue', () => {
  // test('Can add messages to the queue', async ({mq, collection}) => {
  //   let cursor = await collection.find({});
  //   expect(await countCollection(collection)).toEqual(0);

  //   await mq.enqueue('instant-message', 'message0');
  //   await mq.enqueue('instant-message', 'message1');
  //   await mq.enqueue('instant-message', 'message2');

  //   // NOTE: I'm explicitly not testing the contents of the queue
  //   //  that's an implementation detail that could cause false negatives
  //   //  in the future if we were to inspect it.  We'll test that the message
  //   //  comes off the queue with the correct details later.
  //   //  Technically we shouldn't even ben counting the number of rows...
  //   cursor = await collection.find({});
  //   expect(await countCollection(collection)).toEqual(3);
  // });

  // NOTE: This is expected to fail. The current implementation does not match the README
  //   Leaving this in until I've confirmed that the README is wrong and this behavior is expected
  // test('Can queue and process with a later-added worker', async ({mq, collection}, done) => {
  //   await mq.enqueueAndProcess('instant-message', 'message0');

  //   expect(await countCollection(collection)).toEqual(1);

  //   await mq.registerWorker('instant-message', async item => {
  //     expect(item.message).toBe('message0');
  //     expect(item.type).toBe('instant-message');

  //     done();

  //     return 'Completed';
  //   });
  // });

  // test('can immediately process item if worker is set up', async ({mq}, done) => {
  //   await mq.registerWorker('immediate-item', async item => {
  //     expect(item.type).toEqual('immediate-item');
  //     expect(item.message).toEqual('immediate-message');

  //     done();
  //     return 'Completed';
  //   });

  //   await mq.enqueueAndProcess('immediate-item', 'immediate-message');
  // });

  test('if an item is successfully processed, it is removed from the queue', async ({mq, collection, clock}) => {
    await mq.registerWorker('message-queue', async item => {
      expect(item.message).toEqual('item0');

      return 'Completed';
    });

    await mq.enqueue('message-queue', 'item0');
    expect(await countCollection(collection)).toEqual(1);
    clock.tick(1500);
    expect(await countCollection(collection)).toEqual(0);
  });
});

let client;

beforeAll(async () => {
  client = await MongoClient.connect('mongodb://localhost/test', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterAll(() => client.close());

async function setUp({collectionName, createIndex} = {}) {
  const clock = lolex.install();
  // const client = await MongoClient.connect('mongodb://localhost/test', {
  //   poolSize: 1,
  //   useNewUrlParser: true,
  //   useUnifiedTopology: true
  // });
  const db = await client.db();
  const mq = new MessageQueue();

  if (collectionName) {
    mq.collectionName = collectionName;
  }

  if (createIndex !== undefined) {
    mq.createIndex = createIndex;
  }

  const collection = await db.collection(mq.collectionName);
  tryBest(() => collection.drop());

  mq.databasePromise = () => Promise.resolve(db);

  return {
    mq,
    collection,
    clock,
    cleanup: async () => {
      console.log('Stopping...');
      // FIXME: I don't think I like this...
      await tryBest(() => mq.stopPolling());
      await tryBest(() => collection.drop());

      clock.uninstall();
      await flushPromises();

      console.log('Done!');
    }
  };
}

async function countCollection(collection) {
  const cursor = await collection.find({});

  return cursor.count();
}

const flushPromises = () => new Promise(setImmediate);
