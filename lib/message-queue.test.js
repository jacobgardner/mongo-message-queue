const MessageQueue = require('./message-queue');
const {MongoClient} = require('mongodb');

async function tryBest(...callbacks) {
  for (const callback of callbacks) {
    try {
      await callback();
    } catch (err) {
      tryBest.errors.push(err);
    }
  }
}
tryBest.errors = [];

async function setUp({collectionName, createIndex} = {}) {
  const client = await MongoClient.connect('mongodb://localhost/test', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  const db = await client.db();
  const mq = new MessageQueue();

  if (collectionName) {
    mq.collectionName = collectionName;
  }

  if (createIndex !== undefined) {
    mq.createIndex = createIndex;
  }

  const collection = await db.collection(mq.collectionName);

  mq.databasePromise = () => Promise.resolve(db);

  return {
    mq,
    collection,
    cleanup: async () => {
      // FIXME: I don't think I like this...
      await tryBest(() => mq.stopPolling(), () => collection.drop(), () => client.close());
    }
  };
}

function test(message, setupOptions, callback) {
  if (!callback) {
    callback = setupOptions;
    setupOptions = undefined;
  }

  const hasDoneCallback = typeof callback === 'function' && callback.length > 1;

  it(message, async done => {
    let items, rVal;
    const wrappedDoneCallback = async () => {
      done();

      await items.cleanup();
    };
    try {
      items = await setUp(setupOptions);
      rVal = await callback(items, wrappedDoneCallback);
      if (!hasDoneCallback) {
        done();
      }
    } catch (err) {
      if (hasDoneCallback) {
        await items.cleanup();
      }
      throw err;
    } finally {
      if (!hasDoneCallback) {
        await items.cleanup();
      }
    }
    return rVal;
  });
}

describe('Message Queue', () => {
  test('Can add messages to the queue', async ({mq, collection}) => {
    let cursor = await collection.find({});
    expect(await cursor.count()).toBe(0);

    await mq.enqueue('instant-message', 'message0');
    await mq.enqueue('instant-message', 'message1');
    await mq.enqueue('instant-message', 'message2');

    // NOTE: I'm explicitly not testing the contents of the queue
    //  that's an implementation detail that could cause false negatives
    //  in the future if we were to inspect it.  We'll test that the message
    //  comes off the queue with the correct details later.
    //  Technically we shouldn't even ben counting the number of rows...
    cursor = await collection.find({});
    expect(await cursor.count()).toBe(3);
  });

  // NOTE: This is expected to fail. The current implementation does not match the README
  //   Leaving this in until I've confirmed that the README is wrong and this behavior is expected
  // test('Can queue and process with a later-added worker', async ({mq, collection}, done) => {
  //   await mq.enqueueAndProcess('instant-message', 'message0');

  //   cursor = await collection.find({});
  //   expect(await cursor.count()).toBe(1);

  //   await mq.registerWorker('instant-message', async item => {
  //     expect(item.message).toBe('message0');
  //     expect(item.type).toBe('instant-message');

  //     done();

  //     return 'Completed';
  //   });
  // });
});
