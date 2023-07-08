"use strict";

const fs = require("fs");
const tf = require("@tensorflow/tfjs-node");

const ModelsService = {
    loadModel: async function ({ name }) {
        if (fs.existsSync(`./models/${name}`)) {
            console.log("Loading model", name);
            const model = await tf.loadLayersModel(`file://./models/${name}/model.json`);
            console.log("Loaded model from file", {
                name: model.name,
                loss: model.training_loss
            });
            return model;
        }
        console.log("No model found with that name");
        return;
    },
    compileModel: async function (model) {
        console.log("Compiling model");
        await model.compile({
            optimizer: tf.train.adam(model.learning_rate),
            loss: "meanSquaredError"
        });
        return;
    },
    saveModel: async function ({ model }) {
        console.log("Saving model");
        await model.save(`file://./models/${model.name}`);
        return model;
    },
    createModel: async function ({ input_layer_neurons, input_data_features, hidden_layers, output_layer_neurons, learning_rate }) {
        console.log("Model creation parameters", {
            input_layer_neurons,
            input_data_features,
            hidden_layers,
            output_layer_neurons,
            learning_rate
        });
        console.log("Defining input DENSE layer");
        const input_layer_shape = input_data_features;
        console.log("Defining LTSM layer");
        const rnn_input_layer_features = input_data_features;
        const rnn_input_layer_timesteps = input_layer_neurons / rnn_input_layer_features;
        const rnn_input_shape = [rnn_input_layer_features, rnn_input_layer_timesteps];
        const rnn_output_neurons = rnn_input_layer_features;
        console.log("Defining output DENSE layer");
        const output_layer_shape = rnn_output_neurons;
        console.log("Creating sequential model");
        const model = tf.sequential();
        model.name = "sequential";
        console.log("Adding DENSE layer");
        model.add(tf.layers.dense({ units: input_layer_neurons, inputShape: [input_layer_shape] }));
        console.log("Reshaping DENSE layer");
        model.add(tf.layers.reshape({ targetShape: rnn_input_shape }));
        console.log("Creating LSTM cells");
        let lstm_cells = [];
        for (let index = 0; index < hidden_layers; index++) {
            lstm_cells.push(tf.layers.lstmCell({ units: rnn_output_neurons }));
        }
        console.log("Creating RNN layer with LSTM cells");
        model.add(
            tf.layers.rnn({
                cell: lstm_cells,
                inputShape: rnn_input_shape,
                returnSequences: false
            })
        );
        console.log("Adding DENSE layer output");
        model.add(tf.layers.dense({ units: output_layer_neurons, inputShape: [output_layer_shape] }));
        return model;
    },
    trainModel: async function ({ data, split, model, batch_size, epochs }) {
        console.log("Training parameters", {
            data: data.length,
            split,
            model: model.name,
            batch_size,
            epochs
        });
        let { input_data, labeled_data } = ModelsService.labelData(data);
        console.log("Creating input tensor");
        const inputTensor = tf.tensor2d(input_data, [input_data.length, input_data[0].length]);
        console.log("Creating output tensor");
        const labeledTensor = tf.tensor2d(labeled_data, [labeled_data.length, 1]).reshape([labeled_data.length, 1]);
        console.log("Normalizing input tensor");
        const [xs, input_min, input_max] = ModelsService.normalizeTensorFit(inputTensor);
        console.log("Normalizing output tensor");
        const [ys, output_max, output_min] = ModelsService.normalizeTensorFit(labeledTensor);
        console.log("Training model");
        await model.fit(xs, ys, {
            batchSize: batch_size,
            verbose: 1,
            epochs,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    model.training_loss = logs.loss;
                }
            }
        });
        console.log("Adding dictionary to model");
        model.dictionary = {
            input_min,
            input_max,
            output_max,
            output_min
        };
        console.log("Finished training model", model.loss);
        return model;
    },
    makePrediction: async function ({ model, data }) {
        console.log("Making prediction");
        console.log("Creating the input tensor");
        const inputTensor = tf.tensor2d(data, [data.length, data[0].length]);
        console.log("Normalizing the input tensor data");
        const normalizedInput = ModelsService.normalizeTensor(inputTensor, model.dictionary["input_max"], model.dictionary["input_min"]);
        console.log("Executing prediction");
        const model_out = model.predict(normalizedInput);
        console.log("Unnormalizing the output tensor");
        const unnormalizedOutput = ModelsService.unNormalizeTensor(model_out, model.dictionary["output_max"], model.dictionary["output_min"]);
        return Array.from(unnormalizedOutput.dataSync())[0];
    },
    normalizeTensorFit: function (tensor) {
        const minval = tensor.min();
        const maxval = tensor.max();
        const normalizedTensor = ModelsService.normalizeTensor(tensor, minval, maxval);
        return [normalizedTensor, minval, maxval];
    },
    normalizeTensor: function (tensor, minval, maxval) {
        const normalizedTensor = tensor.sub(minval).div(maxval.sub(minval));
        return normalizedTensor;
    },
    unNormalizeTensor: function (tensor, minval, maxval) {
        const unNormTensor = tensor.mul(maxval.sub(minval)).add(minval);
        return unNormTensor;
    },
    labelData: function (data) {
        console.log("Creating labeled data");
        let input_data = data;
        let labeled_data = data.map((input, index) => (input_data[index + 1] ? input_data[index + 1][0] : input[0]));
        return {
            input_data,
            labeled_data
        };
    }
};

module.exports = ModelsService;
