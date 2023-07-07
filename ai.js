const tf = require("@tensorflow/tfjs");
const multer = require("multer");
const { SingleBar, Presets } = require("cli-progress");
const Utils = require("./utils");
const express = require("express");

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

const progressBar = new SingleBar(
    {
        format: "Training {bar} {percentage}% {value}/{total}",
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        hideCursor: true
    },
    Presets.shades_classic
);

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
            Math.abs(object.ema7) || 0,
            Math.abs(trendMap[object.trend] || 0),
            Math.abs(candlestickMap[object.candlestick] || 0)
        ].map(normalize());
    });
    console.log(data[0]);
    var inputData = [];
    for (let i = 0; i < data.length && i < 100; i++) {
        inputData.push(data[i]);
    }
    console.log("Input dataset lenth", inputData.length);
    const inputShape = [inputData.length, 13];
    console.log("Input shape", inputShape);
    const batchSize = 32;
    const epochs = 20;
    const futureSteps = 10;
    console.log("Parameters", {
        batchSize,
        epochs,
        futureSteps
    });
    console.log("Preparing input tensor");
    const inputTensor = tf.tensor(inputData, inputShape);
    console.log("Input tensor", { ...inputTensor });
    const model = tf.sequential();
    console.log("Adding LSTM layer");
    model.add(tf.layers.lstm({ units: 64, inputShape: [1, inputData[0].length] }));
    console.log("Adding DENSE layer");
    model.add(tf.layers.dense({ units: 1 }));
    console.log("Compiling model");
    model.compile({
        optimizer: "adam",
        loss: "meanSquaredError"
    });
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
    progressBar.start(epochs, 0);
    let loss;
    await model.fit(trainingInputTensor, trainingOutputTensor, {
        batchSize,
        epochs,
        validationSplit: 0.2,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                progressBar.update(epoch + 1);
                loss = logs.loss;
            },
            onTrainEnd: () => {
                progressBar.stop();
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

async function saveModel(model) {
    await model.save("http://localhost/models/model.json");
}

async function loadModel() {
    var model = await tf.loadLayersModel("http://localhost/models/model.json");
    return model;
    /*if (fs.existsSync(modelPath)) {
        const model = await tf.loadLayersModel(`file://${modelPath}`);
        console.log("Loaded model from file");
        return model;
    } else {
        const model = tf.sequential();
        model.add(tf.layers.lstm({ units: 64, inputShape: [1, inputData[0].length] }));
        model.add(tf.layers.dense({ units: 1 }));
        model.compile({
            optimizer: "adam",
            loss: "meanSquaredError"
        });
        console.log("Created a new model");
        return model;
    }*/
}

const app = express();
const upload = multer();
app.use(express.static("models"));

app.post(
    "/upload-model",
    upload.fields([
        { name: "modelJson", maxCount: 1 },
        { name: "modelWeights", maxCount: 1 }
    ]),
    (req, res) => {
        const modelJsonFile = req.files["modelJson"][0];
        const modelWeightsFile = req.files["modelWeights"][0];

        const modelJsonPath = "./temp/model.json";
        const modelWeightsPath = "./temp/model.weights.bin";

        // Save model JSON and weights files
        fs.writeFileSync(modelJsonPath, modelJsonFile.buffer);
        fs.writeFileSync(modelWeightsPath, modelWeightsFile.buffer);

        // Load the model using tf.loadLayersModel
        tf.loadLayersModel(tf.io.browserFiles([modelJsonPath, modelWeightsPath]))
            .then((model) => {
                console.log("Model loaded successfully");
                // Do something with the loaded model here
                res.send("Model uploaded and loaded successfully");
            })
            .catch((error) => {
                console.error("Error loading model:", error);
                res.status(500).send("Error loading model");
            });
    }
);

// Start the server
app.listen(80, () => {
    console.log("Server is running on port 80");
    analyzeTimeSeries();
});
