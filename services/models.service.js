"use strict";

const fs = require("fs");
const tf = require("@tensorflow/tfjs-node");
const DataService = require("./data.service");

const ModelsService = {
    loadModel: async function ({ name }) {
        /*if (fs.existsSync(`./models/${name}.json`)) {
            console.log("Loading model", name);
            const model = await tf.loadLayersModel(`file://./models/${name}.json`);
            console.log("Loaded model from file");
            return model;
        }*/
        console.log("No model found with that name");
        return;
    },
    saveModel: async function ({ name, model }) {
        console.log("Saving model");
        await model.save(`file://./models/${name}.json`);
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
        console.log("Compiling model");
        model.compile({
            optimizer: tf.train.adam(learning_rate),
            loss: "meanSquaredError"
        });
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
        let { input_data, output_data } = ModelsService.splitData({ data, split });
        console.log("Creating input tensor");
        const inputTensor = tf.tensor2d(input_data, [input_data.length, input_data[0].length]);
        console.log("Creating output tensor");
        const outputTensor = tf.tensor2d(output_data, [output_data.length, 1]).reshape([output_data.length, 1]);
        console.log("Normalizing input tensor");
        const [xs, input_min, input_max] = ModelsService.normalizeTensorFit(inputTensor);
        console.log("Normalizing output tensor");
        const [ys, output_max, output_min] = ModelsService.normalizeTensorFit(outputTensor);
        console.log("Training model");
        let loss;
        await model.fit(xs, ys, {
            validationSplit: 0.2,
            batchSize: batch_size,
            verbose: 0,
            epochs,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    console.log("Epoch:", epoch + 1);
                    console.log("Loss:", logs.loss);
                    loss = logs.loss;
                }
            }
        });
        console.log("Finished training model");
        console.log("Model loss", loss);
        return {
            model,
            dictionary: {
                input_min,
                input_max,
                output_max,
                output_min
            }
        };
    },
    makePrediction: async function ({ model, data, dictionary }) {
        console.log("Making prediction");
        console.log("Creating the input tensor");
        data = tf.tensor2d(data, [data.length, data[0].length]);
        console.log("Normalizing the tensor data");
        const normalizedInput = ModelsService.normalizeTensor(data, dictionary["input_max"], dictionary["input_min"]);
        console.log("Executing prediction");
        const model_out = model.predict(normalizedInput);
        console.log("Unormalizing tensor");
        const predictedResults = ModelsService.unNormalizeTensor(model_out, dictionary["output_max"], dictionary["output_min"]);
        console.log(Array.from(predictedResults.dataSync()));
        return Array.from(predictedResults.dataSync());
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
    splitData: function ({ data, split }) {
        console.log("Splitting data");
        if (!split) {
            split = 0.8;
        }
        let input_data = data.slice(0, Math.floor(split * data.length));
        let output_data = data.map((input, index) => (input_data[index + 1] ? input_data[index + 1][0] : input[0]));
        output_data = output_data.slice(0, Math.floor(split * output_data.length));
        console.log({
            data: data.length,
            input_data: input_data.length,
            output_data: output_data.length
        });
        return {
            input_data,
            output_data
        };
    }
};

module.exports = ModelsService;
