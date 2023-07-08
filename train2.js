const tf = require("@tensorflow/tfjs-node");
const Utils = require("./utils");

async function trainModel(X, Y, window_size, n_epochs, learning_rate, n_layers, callback) {
    const batch_size = 32;
    console.log("Defining input DENSE layer");
    const input_layer_shape = window_size;
    const input_layer_neurons = 64;
    console.log("Defining LTSM layer");
    const rnn_input_layer_features = 16;
    const rnn_input_layer_timesteps = input_layer_neurons / rnn_input_layer_features;
    const rnn_input_shape = [rnn_input_layer_features, rnn_input_layer_timesteps]; // the shape have to match input layer's shape
    const rnn_output_neurons = rnn_input_layer_features; // number of neurons per LSTM's cell
    console.log("Defining output DENSE layer");
    const output_layer_shape = rnn_output_neurons; // dense layer input size is same as LSTM cell
    const output_layer_neurons = 1; // return 1 value
    // ## old method
    // const xs = tf.tensor2d(X, [X.length, X[0].length])//.div(tf.scalar(10));
    // const ys = tf.tensor2d(Y, [Y.length, 1]).reshape([Y.length, 1])//.div(tf.scalar(10));
    // ## new: load data into tensor and normalize data
    console.log("Creating input tensor");
    const inputTensor = tf.tensor2d(X, [X.length, X[0].length]);
    console.log("Creating label tensor");
    const outputTensor = tf.tensor2d(Y, [Y.length, 1]).reshape([Y.length, 1]);
    console.log("Normalizing input tensor");
    const [xs, inputMax, inputMin] = normalizeTensorFit(inputTensor);
    console.log("Creating label tensor");
    const [ys, labelMax, labelMin] = normalizeTensorFit(outputTensor);
    console.log("Creating sequential model");
    const model = tf.sequential();
    console.log("Adding DENSE layer");
    model.add(tf.layers.dense({ units: input_layer_neurons, inputShape: [input_layer_shape] }));
    console.log("Reshaping DENSE layer");
    model.add(tf.layers.reshape({ targetShape: rnn_input_shape }));
    console.log("Creating LSTM cells");
    let lstm_cells = [];
    for (let index = 0; index < n_layers; index++) {
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
    console.log("Training model");
    await model.fit(xs, ys, {
        batchSize: batch_size,
        epochs: n_epochs,
        callbacks: {
            onEpochEnd: async (epoch, log) => {
                callback(epoch, log);
            }
        }
    });
    console.log(13);
    await makePredictions(X, model, {
        inputMax: inputMax, // Maximum value used for input normalization
        inputMin: inputMin, // Minimum value used for input normalization
        labelMax: labelMax, // Maximum value used for label normalization
        labelMin: labelMin // Minimum value used for label normalization
    });
    process.exit();
}

function normalizeTensorFit(tensor) {
    const minval = tensor.min();
    const maxval = tensor.max();
    const normalizedTensor = normalizeTensor(tensor, minval, maxval);
    return [normalizedTensor, minval, maxval];
}

function normalizeTensor(tensor, minval, maxval) {
    const normalizedTensor = tensor.sub(minval).div(maxval.sub(minval));
    return normalizedTensor;
}

function unNormalizeTensor(tensor, minval, maxval) {
    const unNormTensor = tensor.mul(maxval.sub(minval)).add(minval);
    return unNormTensor;
}

function makePredictions(X, model, dict_normalize) {
    // const predictedResults = model.predict(tf.tensor2d(X, [X.length, X[0].length]).div(tf.scalar(10))).mul(10); // old method
    console.log("Making prediction");
    console.log("Creating the input tensor");
    X = tf.tensor2d(X, [X.length, X[0].length]);
    console.log("Normalizing the tensor data");
    const normalizedInput = normalizeTensor(X, dict_normalize["inputMax"], dict_normalize["inputMin"]);
    console.log("Executing prediction");
    const model_out = model.predict(normalizedInput);
    console.log("Unormalizing tensor");
    const predictedResults = unNormalizeTensor(model_out, dict_normalize["labelMax"], dict_normalize["labelMin"]);
    console.log(Array.from(predictedResults.dataSync()));
    return Array.from(predictedResults.dataSync());
}

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

async function getData() {
    var inputs = (await Utils.readJSON("BTCUSDT")).map((object) => {
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
            Math.abs(eventMap[object.events[1]] || 0),
            Math.abs(eventMap[object.events[2]] || 0),
            Math.abs(eventMap[object.events[3]] || 0),
            Math.abs(trendMap[object.trend] || 0),
            Math.abs(candlestickMap[object.candlestick] || 0)
        ];
    });
    var outputs = inputs.map((input) => input[0]);

    let window_size = 16;
    let trainingsize = 80;
    let n_epochs = 1;
    let learningrate = 0.01;
    let n_hiddenlayers = 1;

    inputs = inputs.slice(0, Math.floor((trainingsize / 100) * inputs.length));
    outputs = outputs.slice(0, Math.floor((trainingsize / 100) * outputs.length));

    let callback = function (epoch, log) {
        console.log(`Epoch: ${epoch + 1}, Loss: ${log.loss}`);
    };

    await trainModel(inputs, outputs, window_size, n_epochs, learningrate, n_hiddenlayers, callback);
}

getData();
