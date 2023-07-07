const tf = require("@tensorflow/tfjs");

// Example time series data
const data = [
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"],
    [1.2, 1.3, 1.4, 1.1, 1000, 1.2, 50, 60, 70, "up", "bullish", "none", "bb"],
    [1.3, 1.4, 1.5, 1.2, 1200, 1.3, 60, 70, 80, "down", "bearish", "event1", "bb"]
];

// Set the input shape and other parameters
const inputShape = [Math.floor(data.length / 10), 13];
const trainSize = 100;
const numEpochs = 50;
const futureSteps = 10;
async function analyzeTimeSeries(data, futureSteps) {
    // Normalize the input data
    const normalizedData = normalizeData(data);
    console.log(1);

    const inputData = normalizedData.slice([0, 0], [-1, inputShape[1]]);
    const outputData = normalizedData.slice([0, inputShape[1] - 1], [-1, 1]);
    console.log(2);

    console.log(3);
    const inputTensor = tf.tensor(inputData.arraySync());
    const outputTensor = tf.tensor(outputData.arraySync());
    console.log({
        inputData,
        outputData
    });
    console.log(4);

    const reshapedInput = inputTensor.reshape([-1, inputShape[0], inputShape[1]]);
    console.log({
        inputShape,
        reshapedInput
    });
    const reshapedOutput = outputTensor.reshape([-1, 1]);
    console.log(5);

    // Split the data into training and testing
    const trainSize = Math.floor(inputData.shape[0] * 0.8);
    console.log(6);
    const trainData = [];
    for (let i = 0; i < trainSize; i++) {
        const startIndex = Math.min(i, reshapedInput.shape[0] - 1);
        trainData.push({
            xs: reshapedInput.slice([startIndex, 0, 0], [1, -1, -1]),
            ys: reshapedOutput.slice([startIndex, 0], [1, -1])
        });
    }

    console.log(7);
    const testSize = inputData.shape[0] - trainSize;
    const testData = [];
    for (let i = 0; i < testSize; i++) {
        const startIndex = Math.min(trainSize + i, reshapedInput.shape[0] - 1);
        testData.push({
            xs: reshapedInput.slice([startIndex, 0, 0], [1, -1, -1]),
            ys: reshapedOutput.slice([startIndex, 0], [1, -1])
        });
    }

    console.log(testData[0]);
    var trainX = tf.stack(trainData.map((item) => item.xs));
    var trainY = tf.squeeze(tf.stack(trainData.map((item) => item.ys)), [1]);
    var testX = tf.stack(testData.map((item) => item.xs));
    var testY = tf.stack(testData.map((item) => item.ys));

    console.log(9);

    // Create the LSTM model
    const model = createLSTMModel([Math.floor(data.length / 10), 13]);
    console.log(10);

    // Train the model
    trainX = tf.reshape(trainX, [20, 2, 13]);
    trainY = tf.squeeze(trainY, [1]);

    console.log({
        trainX,
        trainY
    });
    try {
        await model.fit(trainX, trainY, { epochs: numEpochs, verbose: 0 });
    } catch (error) {
        console.error(error);
        process.exit();
    }
    console.log(11);

    // Evaluate the model
    testX = testX.reshape([6, 2, 13]);
    testY = testY.reshape([6, 1]);

    const evaluation = model.evaluate(testX, testY);
    console.log("Evaluation Loss:", evaluation.dataSync()[0]);

    // Make predictions for future steps
    console.log(12);
    const futureInput = reshapedInput.slice([reshapedInput.shape[0] - futureSteps, 0, 0], [futureSteps, -1, -1]);
    console.log(13);
    const predictedY = model.predict(futureInput);
    console.log(14);
    // Denormalize the predicted values
    const denormalizedY = denormalizeData(predictedY, outputTensor);
    console.log(15);
    // Print the predicted values
    console.log("Predicted Values:");
    denormalizedY.print();
}

function normalizeData(data) {
    if (!(data instanceof tf.Tensor)) {
        data = tf.tensor2d(data);
    }
    const numericalData = data.slice([0, 0], [-1, 9]);
    const textualData = data.slice([0, 9], [-1, 4]);
    const { mean, variance } = tf.moments(numericalData, 0);
    const dataStd = variance.sqrt();
    const normalizedNumericalData = numericalData.sub(mean).div(dataStd);
    return tf.concat([textualData, normalizedNumericalData], 1);
}

function denormalizeData(data, originalData) {
    const originalDataMin = originalData.min();
    const originalDataMax = originalData.max();
    const denormalizedData = data.mul(originalDataMax.sub(originalDataMin)).add(originalDataMin);
    return denormalizedData;
}

function createLSTMModel(inputShape) {
    const model = tf.sequential();
    model.add(
        tf.layers.lstm({
            units: 32,
            inputShape: inputShape,
            returnSequences: false
        })
    );
    model.add(tf.layers.dense({ units: 1 }));

    model.compile({ loss: "meanSquaredError", optimizer: "adam" });

    return model;
}

// Call the analyzeTimeSeries function
analyzeTimeSeries(data, futureSteps);
