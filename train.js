const tf = require("@tensorflow/tfjs");
const fs = require("fs");

async function trainModelAndSave(modelFilePath, newData) {
    let model;

    // Check if the model file exists
    if (fs.existsSync(modelFilePath)) {
        // Load the existing model from file
        model = await tf.loadLayersModel(`file: //${modelFilePath}`);
    } else {
        // Create a new model if the file doesn't exist
        model = createModel();
    }

    // Prepare the data for training
    const { inputs, labels } = prepareData(newData);

    // Convert the data into TensorFlow tensors
    const xTrain = tf.tensor2d(inputs);
    const yTrain = tf.tensor2d(labels);

    // Train the model
    await model.fit(xTrain, yTrain, { epochs: 10 });

    // Save the updated model to the file
    await model.save(`file://${modelFilePath}`);

    console.log("Model updated and saved successfully!");
}

function createModel() {
    // Create and return a new model
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 2, inputShape: [2], activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    model.compile({ loss: "binaryCrossentropy", optimizer: "adam" });
    return model;
}

function prepareData(newData) {
    // Your data preparation logic here
    // Convert the new data into training inputs and labels
    // Return an object with 'inputs' and 'labels'

    // Example data preparation
    const inputs = newData.map((item) => item.input);
    const labels = newData.map((item) => item.label);

    return { inputs, labels };
}

// Usage example
const modelFilePath = "model/model.json";
const newData = [
    { input: [0, 0], label: [0] },
    { input: [0, 1], label: [1] },
    { input: [1, 0], label: [1] },
    { input: [1, 1], label: [0] }
];

trainModelAndSave(modelFilePath, newData).catch((error) => console.error("An error occurred:", error));
