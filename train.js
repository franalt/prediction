const tf = require("@tensorflow/tfjs-node");
const fs = require("fs");
const Utils = require("./utils");
const express = require("express");
const modelFilePath = "./model";

const candlestickMap = {
    down: 0,
    doji: 1,
    up: 2
};

const trendMap = {
    uptrend: 2,
    neutral: 1,
    downtrend: 0
};

const eventMap = {
    bb_bottom_cross_up: 1,
    bb_bottom_cross_down: 2,
    bb_top_cross_up: 3,
    bb_top_cross_up: 4,
    bb_top_cross_down: 5,
    supertrend_sell: 6,
    supertrend_buy: 7,
    cci_oversold_start: 8,
    cci_oversold_end: 9,
    cci_overbought_start: 10,
    cci_overbought_end: 11,
    rsi7_oversold_start: 12,
    rsi7_oversold_end: 13,
    rsi7_overbought_start: 14,
    rsi7_overbought_end: 15,
    rsi14_oversold_start: 16,
    rsi14_oversold_end: 17,
    rsi14_overbought_start: 18,
    rsi14_overbought_end: 19,
    mfi_oversold_start: 20,
    mfi_oversold_end: 21,
    mfi_overbought_start: 22,
    mfi_overbought_end: 23,
    macd_bearish_momentum_decay: 24,
    macd_bullish_momentum_decay: 25,
    macd_bullish_crossover: 26,
    macd_bearish_crossover: 27,
    emaFast_bullish_crossover: 28,
    emaFast_bearish_crossover: 29,
    emaSlow_bullish_crossover: 30,
    emaSlow_bearish_crossover: 31
};

var inputData = [];
async function analyzeTimeSeries() {
    var data = (await Utils.readJSON("BTCUSDT")).map((object) => {
        return [
            object.close,
            object.open,
            object.high,
            object.low,
            object.volume,
            Math.abs(object.atr14) || 0,
            Math.abs(object.cci14) || 0,
            Math.abs(object.mfi14) || 0,
            Math.abs(object.rsi7) || 0,
            Math.abs(object.rsi14) || 0,
            Math.abs(eventMap[object.events[0]] || 0),
            Math.abs(trendMap[object.trend] || 0),
            Math.abs(candlestickMap[object.candlestick] || 0)
        ].map(normalize());
    });
    for (let i = 0; i < data.length; i++) {
        inputData.push(data[i]);
    }
    console.log("Input dataset lenth", inputData.length);
    const inputShape = [inputData.length, 13];
    console.log("Input shape", inputShape);
    const batchSize = 128;
    const epochs = 20;
    console.log("Parameters", {
        batchSize,
        epochs
    });
    console.log("Preparing input tensor");
    const inputTensor = tf.tensor(inputData, inputShape);
    console.log("Input tensor", { ...inputTensor });
    const model = await loadModel();
    const trainingInputData = [];
    const trainingTargetData = [];
    for (let i = 0; i < inputData.length; i++) {
        trainingInputData.push(inputData[i]);
        trainingTargetData.push((inputData[i + 1] || inputData[i])[0]);
    }
    const trainingInputTensor = tf.tensor(trainingInputData, [trainingInputData.length, 1, trainingInputData[0].length]);
    console.log({
        trainingInputTensor
    });
    const trainingOutputTensor = tf.tensor1d(trainingTargetData);
    console.log({
        trainingOutputTensor
    });
    model.compile({
        optimizer: "adam",
        loss: "meanSquaredError"
    });
    let loss;
    await model.fit(trainingInputTensor, trainingOutputTensor, {
        batchSize,
        epochs,
        shuffle: false,
        validationSplit: 0.2,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                loss = logs.loss;
            }
        }
    });
    await saveModel(model);
    console.log("Training completed, loss:", loss);

    // Prepare the input data for prediction
    const predictionInputData = inputData.slice(-1); // Use the last 10 data points for prediction
    const predictionInputTensor = tf.tensor(predictionInputData, [predictionInputData.length, 1, predictionInputData[0].length]);
    console.log({
        predictionInputTensor
    });
    // Make predictions
    const predictions = model.predict(predictionInputTensor);
    const predictedValues = Array.from(predictions.dataSync()); // Convert tensor to an array

    // Display the predicted values
    console.log("Predicted values:", predictedValues.map(denormalize())[0], inputData.slice(-1)[0].map(denormalize())[0]);
}

function normalize() {
    var delta = 100000;
    return function (val) {
        return val / delta;
    };
}

function denormalize() {
    var delta = 100000;
    return function (val) {
        return val * delta;
    };
}

function createModel() {
    var model = tf.sequential();
    model.add(tf.layers.lstm({ units: 64, inputShape: [1, inputData[0].length] }));
    model.add(tf.layers.dense({ units: 1 }));
    return model;
}
async function saveModel(model) {
    await model.save(`file://${modelFilePath}`);
    console.log("Model saved");
}

// Load or create the model
async function loadModel() {
    if (fs.existsSync(`${modelFilePath}/model.json`)) {
        // Load the existing model
        const model = await tf.loadLayersModel(`file://${modelFilePath}/model.json`);
        console.log("Loaded model from file");
        return model;
    } else {
        // Create a new model
        const model = createModel();
        console.log("Created a new model");
        return model;
    }
}
analyzeTimeSeries();
