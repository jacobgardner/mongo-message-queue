function buildTest(setUpCallback) {
  return (message, setupOptions, callback) => {
    if (!callback) {
      callback = setupOptions;
      setupOptions = undefined;
    }

    const hasDoneCallback = typeof callback === 'function' && callback.length > 1;

    describe('', () => {
      let items;
      beforeAll(async () => {
        console.log('======================');
        console.log('Before...');
        items = await setUpCallback(setupOptions);
      });

      afterAll(async () => {
        console.log('After...');
        await items.cleanup();
        console.log('---------------------')
      });

      it(message, async done => {
        const rVal = await callback(items, done);

        if (!hasDoneCallback) {
          done();
        }

        return rVal;
      });
    });
  };
}

async function tryBest(...callbacks) {
  for (const callback of callbacks) {
    try {
      await callback();
    } catch (err) {
      console.error(err);
      tryBest.errors.push(err);
    }
  }
}
tryBest.errors = [];

module.exports = {
  tryBest,
  buildTest
};
