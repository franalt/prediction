"use strict";

const axios = require("axios");
const fs = require("fs");

const Utils = {
    respond: async function (req, res, fn) {
        try {
            var parameters;
            if (req.method === "POST") {
                parameters = req.body;
            } else {
                parameters = req.query;
            }
            if (req.user) {
                parameters.user = req.user;
            }
            if (req.account) {
                parameters.account = req.account;
            }
            var ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.connection.remoteAddress;
            if (ip.substr(0, 7) == "::ffff:") {
                ip = ip.substr(7);
            }
            parameters.ip = ip;
            parameters = {
                ...parameters,
                ...req.params
            };
            console.log(req.method, `${req.baseUrl}${req.route.path}`, parameters);
            parameters.authorization = req.headers.authorization;
            var response = await fn(parameters);
            response = removeParsePointers(response);
            console.log(response);
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Methods", "GET,POST,DELETE");
            res.header("Access-Control-Allow-Headers", "Content-Type");
            return res.status(200).send(response);
        } catch (error) {
            console.log(error);
            if (error instanceof Error) {
                return res.status(500).send("Something went wrong");
            } else {
                return res.status(400).send(error);
            }
        }
    },
    parseQuery: async function ({ classname, filters, sort, offset, limit, search }) {
        try {
            var query = new Parse.Query(classname);
            console.log(`Getting ${classname} schema`);
            var schema;
            try {
                schema = await getClassSchema(classname, true);
            } catch (error) {
                console.error(error);
            }
            var queries = [];
            if (filters) {
                console.log(`Filtering query`, filters);
                for (let key in filters) {
                    if (filters[key].value === undefined) {
                        continue;
                    }
                    if (filters[key].type === "matches") {
                        var strings = filters[key].value.split(" ");
                        for (var i = 0; i < strings.length; i++) {
                            var stringQuery = new Parse.Query(query.className);
                            stringQuery.matches(filters[key].key, strings[i], "i");
                            queries.push(stringQuery);
                        }
                    } else if (filters[key].type === "equals") {
                        var equalsQuery = new Parse.Query(query.className);
                        if (schema?.fields[filters[key].key]?.type === "Pointer") {
                            var pointerClass = Parse.Object.extend(schema.fields[filters[key].key].targetClass);
                            var pointer = new pointerClass();
                            pointer.id = filters[key].value;
                            equalsQuery.equalTo(filters[key].key, pointer);
                        } else if (schema?.fields[filters[key].key]?.type === "Boolean") {
                            equalsQuery.equalTo(filters[key].key, filters[key].value === "true" ? true : false);
                        } else {
                            equalsQuery.equalTo(filters[key].key, filters[key].value);
                        }
                        queries.push(equalsQuery);
                    } else if (filters[key].type === "contained") {
                        var containedQuery = new Parse.Query(query.className);
                        containedQuery.containedIn(filters[key].key, filters[key].value);
                        queries.push(containedQuery);
                    } else if (filters[key].type === "greater") {
                        var greaterQuery = new Parse.Query(query.className);
                        greaterQuery.greaterThan(filters[key].key, filters[key].value);
                        queries.push(greaterQuery);
                    } else if (filters[key].type === "less") {
                        var lessQuery = new Parse.Query(query.className);
                        lessQuery.lessThan(filters[key].key, filters[key].value);
                        queries.push(lessQuery);
                    } else if (filters[key].type === "exists") {
                        var existsQuery = new Parse.Query(query.className);
                        if (filters[key].value) {
                            existsQuery.exists(filters[key].key);
                        } else {
                            existsQuery.doesNotExist(filters[key].key);
                        }
                        queries.push(existsQuery);
                    }
                }
            }

            if (search) {
                console.log(`Searching query`, search);
                var strings = search.split(" ");
                var strings_queries = [];
                for (var i = 0; i < strings.length; i++) {
                    var key_queries = [];
                    for (var key in schema.fields) {
                        if (key !== "objectId" && schema.fields[key].type === "String") {
                            //console.log(schema.className, key, strings[i], 'i');
                            var keyQuery = new Parse.Query(schema.className);
                            keyQuery.matches(key, strings[i], "i");
                            key_queries.push(keyQuery);
                        } /* else if (schema.fields[key].type === 'Pointer') {
                            for (var pointer_key in schema.fields[key].fields.fields) {
                                if (pointer_key !== 'objectId' && schema.fields[key].fields.fields[pointer_key].type === 'String') {
                                    console.log('Pointer field', schema.fields[key].fields.fields[pointer_key]);
                                    console.log(schema.fields[key].targetClass, `${key}.${pointer_key}`, strings[i], 'i');
                                    var pointerKeyQuery = new Parse.Query(schema.className);
                                    pointerKeyQuery.matches(`${key}.${pointer_key}`, strings[i], 'i');
                                    key_queries.push(pointerKeyQuery);
                                }
                            }
                        }*/
                    }
                    strings_queries.push(Parse.Query.or(...key_queries));
                }
                queries.push(Parse.Query.and(...strings_queries));
            }
            if (queries?.length) {
                query = Parse.Query.and(...queries);
            }
            if (sort?.key) {
                query[sort.order](sort.key);
            }
            for (let key in schema?.fields) {
                if (schema.fields[key].type === "Pointer") {
                    console.log(`Including ${key}`);
                    query.include(key);
                    console.log(schema.fields[key].fields.fields);
                    for (let pointer_key in schema.fields[key].fields.fields) {
                        if (schema.fields[key].fields.fields[pointer_key].type === "Pointer") {
                            console.log(`Including ${key}.${pointer_key}`);
                            query.include(`${key}.${pointer_key}`);
                        }
                    }
                }
            }
            console.log(`Counting query results`);
            var count = await query.count();
            console.log(`There are ${count} results`);
            var results = [];
            var pagination = {
                offset: 0,
                count
            };
            if (offset !== undefined) {
                pagination.offset = Number(offset);
                if (!limit) {
                    pagination.limit = 10;
                } else {
                    pagination.limit = Number(limit);
                }
                console.log(`Limiting results to ${pagination.limit}`);
                query.limit(pagination.limit);
                console.log(`Offsetting results by ${pagination.offset}`);
                query.skip(pagination.offset);
                results = await query.find();
            } else {
                do {
                    query.skip(results.length);
                    query.limit(100);
                    results.push(...(await query.find()));
                } while (results.length < count);
            }
            return {
                results,
                pagination
            };
        } catch (error) {
            console.error(error);
            throw new Error("Failed to execute query");
        }
    },
    destroyAllObjectsInQuery: async function (query) {
        await Parse.Object.destroyAll(await Utils.getAllObjectsInQuery(query));
        return "Cleared query results";
    },
    getAllObjectsInQuery: async function (query) {
        query.descending("createdAt");
        var objects = [];
        do {
            query.skip(objects.length);
            query.limit(100);
            var results = await query.find();
            objects.push(...results);
        } while (results.length);
        return objects;
    },
    parseFile: function (base64) {
        var type = base64.split(";")[0];
        if (type.includes("svg")) {
            type = "svg";
        } else if (type.includes("gif")) {
            type = "gif";
        } else if (type.includes("png")) {
            type = "png";
        } else if (type.includes("jpg")) {
            type = "jpg";
        } else if (type.includes("jpeg")) {
            type = "jpeg";
        } else if (type.includes("pdf")) {
            type = "pdf";
        }
        return new Parse.File(`file.${type}`, { base64: base64 });
    },
    validatePassword: function (variable) {
        var message;
        if (typeof variable !== "string") {
            message = "The password must be a string";
        } /* else if (variable.length < 6) {
            message = 'The password must contain at least 6 characters';
        } else if (!hasUppercaseLetter(variable)) {
            message = 'The password must contain an uppercase letter';
        } else if (!hasLowercaseLetter(variable)) {
            message = 'The password must contain a lowercase letter';
        } else if (!hasNumber(variable)) {
            message = 'The password must contain a number';
        }*/
        if (message) {
            console.error("Password validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    validateAddress: function (variable) {
        console.log(variable);
        var message;
        if (typeof variable !== "object") {
            message = "The address must be an object";
        } else if (typeof variable.street !== "string") {
            message = "The address street must be a string";
        } else if (variable.additional && typeof variable.additional !== "string") {
            message = "The address additional must be a string";
        } else if (typeof variable.zip !== "string") {
            message = "The address zip must be a string";
        } else if (typeof variable.city?.id !== "string") {
            message = "The address city must be an object with an ID";
        } else if (!variable.state?.id) {
            message = "The address state must be an object with an ID";
        } else if (!variable.country?.id) {
            message = "The address country must be an object with an ID";
        }
        if (message) {
            console.error("Address validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    validateEmail: function (variable) {
        const validation_string = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        var message;
        if (!validation_string.test(String(variable).toLowerCase())) {
            message = "The email has an invalid format";
        }
        if (message) {
            console.error("Email validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    validateString: function (variable, min_length, max_length) {
        var message;
        if (typeof variable !== "string") {
            message = "The variable must be a string";
        } else if (min_length && variable.length < min_length) {
            message = `The variable should contain at least ${min_length} characters`;
        } else if (max_length && variable.length > max_length) {
            message = `The variable length cannot exceed ${max_length} characters`;
        }
        if (message) {
            console.error("String validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    containedInArray: function (variable, array) {
        for (let i = 0; i < array.length; i++) {
            if (array[i] === variable) {
                return true;
            }
        }
        return false;
    },
    validateNumber: function (variable, min_value, max_value) {
        var message;
        if (typeof variable !== "number") {
            message = "The variable must be a number";
        } else if (min_value && variable.length < min_value) {
            message = `The variable must be greater than ${min_value}`;
        } else if (max_value && variable.length > max_value) {
            message = `The variable must be less than ${max_value}`;
        }
        if (message) {
            console.error("Number validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    validateInteger: function (variable, min_value, max_value) {
        var message;
        if (typeof variable !== "number") {
            message = "The variable must be a number";
        } else if (!Number.isInteger(variable)) {
            message = "The variable must be an integer";
        } else if (min_value && variable.length < min_value) {
            message = `The variable must be greater than ${min_value}`;
        } else if (max_value && variable.length > max_value) {
            message = `The variable must be less than ${max_value}`;
        }
        if (message) {
            console.error("Number validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    validateDate: function (variable, min_date, max_date) {
        var date;
        var message;
        if (!(variable instanceof Date)) {
            var validation_string = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;
            if (!validation_string.test(String(variable))) {
                message = "The date has an invalid format";
            }
            date = new Date(variable);
        } else {
            date = variable;
        }
        if (min_date && date < min_date) {
            message = `The date should be after than ${min_date}`;
        } else if (max_date && date > max_date) {
            message = `The date should be before ${max_date}`;
        }
        if (message) {
            console.error("Date validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    validateURL: function (variable) {
        //const validation_string = /^(?:(?:(?:https?|http):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})).?)(?::\d{2,5})?(?:[/?#]\S*)?$/i;
        var message;
        if (!variable.includes("http://") && !variable.includes("https://")) {
            message = "The URL has an invalid format";
        }
        /*if (!validation_string.test(variable)) {
            message = 'The URL has an invalid format';
          }*/
        if (message) {
            console.error("URL validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    validateFile: function (variable, type) {
        var message;
        if (typeof variable !== "string" || variable.length < 1) {
            message = "The file must be a string";
        }
        if (!message) {
            if (!variable.includes("data:") || !variable.includes(";base64,")) {
                message = "Invalid format";
            }
            var base64type = variable.split(";")[0];
            if (base64type.includes("svg")) {
                base64type = "svg";
            } else if (base64type.includes("gif")) {
                base64type = "gif";
            } else if (base64type.includes("png")) {
                base64type = "png";
            } else if (base64type.includes("jpg")) {
                base64type = "jpg";
            } else if (base64type.includes("jpeg")) {
                base64type = "jpeg";
            } else if (base64type.includes("pdf")) {
                base64type = "pdf";
            }
            if (!base64type) {
                message = "Invalid file type";
            }
            if (type && base64type !== type) {
                message = `File must be of type ${type}`;
            }
        }
        if (message) {
            console.error("File validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    validateBoolean: function (variable, value) {
        var message;
        if (typeof variable !== "boolean") {
            message = "The variable must be a boolean";
        } else if (value && variable !== value) {
            message = `The variable must be ${value}`;
        }
        if (message) {
            console.error("Boolean validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    validatePhone: function (variable) {
        var message;
        if (typeof variable !== "string") {
            message = "The phone must be an string";
        }
        console.log(variable, variable.length);
        if (variable.length !== 10 && variable.length !== 11) {
            message = "Phone must contain 10 or 11 digits";
        }
        if (message) {
            console.error("Phone validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    validateArray: function (variable, min_length, max_length) {
        var message;
        if (!Array.isArray(variable)) {
            message = "The variable must be an array";
        } else if (min_length && variable.length < min_length) {
            message = `The variable length must be greater than ${min_length}`;
        } else if (max_length && variable.length > max_length) {
            message = `The variable length must be less than ${max_length}`;
        }
        if (message) {
            console.error("Array validation failed", message);
            return {
                valid: false,
                message: message
            };
        } else {
            return {
                valid: true
            };
        }
    },
    validateVat: function (variable) {
        variable = variable?.toString();
        if (variable?.length !== 11) {
            return {
                valid: false,
                message: "Invalid CUIT/CUIL"
            };
        }

        const [checkDigit, ...rest] = variable.split("").map(Number).reverse();

        const total = rest.reduce((acc, cur, index) => acc + cur * (2 + (index % 6)), 0);

        const mod11 = 11 - (total % 11);

        if (mod11 === 11) {
            if (checkDigit !== 0) {
                return {
                    valid: false,
                    message: "Invalid CUIT/CUIL"
                };
            } else {
                return {
                    valid: true
                };
            }
        }

        if (mod11 === 10) {
            return {
                valid: false,
                message: "Invalid CUIT/CUIL"
            };
        }
        if (checkDigit === mod11) {
            return {
                valid: true
            };
        } else {
            return {
                valid: false,
                message: "Invalid CUIT/CUIL"
            };
        }
    },
    roundNumber: function (number) {
        return Math.round((number + Number.EPSILON) * 100) / 100;
    },
    formatDate: function (date, format) {
        if (!format) {
            format = "dd mm yy";
        }
        var string = "";
        if (format.split(" ")[0] === "dd") {
            string += date.getDate() + " ";
        } else {
            string += date.getDate() + " ";
        }
        if (format.split(" ")[1] === "mm") {
            string += date.getMonth() + 1 + " ";
        } else {
            string += date.getMonth() + 1 + " ";
        }
        if (format.split(" ")[1] === "yy") {
            string += date.getFullYear();
        } else {
            string += date.getFullYear();
        }
        return string;
    },
    formatCurrency: function (number) {
        number = number.toFixed(2);
        var whole = Number(number.split(".")[0]).toLocaleString("en").replace(/,/g, ".");
        var decimals = number.split(".")[1];
        if (!decimals) {
            decimals = "00";
        } else if (decimals.length === 1) {
            decimals += 0;
        }
        return whole + "," + decimals;
    },
    getEndDate: function (end_date) {
        if (!Utils.validateDate(end_date).valid) {
            throw "Invalid date";
        }
        const dateEnd = new Date(end_date);
        dateEnd.setUTCHours(23, 59, 59, 999);
        return dateEnd;
    },
    getStartDate: function (start_date) {
        if (!Utils.validateDate(start_date).valid) {
            throw "Invalid date";
        }
        const dateStart = new Date(start_date);
        dateStart.setUTCHours(0, 0, 0, 0);
        return dateStart;
    },
    getTotal: function (array, key) {
        var acumulator = 0;
        for (let i = 0; i < array.length; i++) {
            if (Utils.validateNumber(array[i][key]).valid) {
                acumulator += array[i][key];
            }
        }
        return acumulator;
    },
    extractNumbersFromString(string) {
        return Number(string.replace(/^\D+/g, "") || 0);
    },
    sortArrayByKey(array, key, order) {
        if (!order || order === "ascending") {
            return array.sort(function (a, b) {
                if (a[key] < b[key]) return -1;
                if (a[key] > b[key]) return 1;
                return 0;
            });
        } else {
            return array.sort(function (a, b) {
                if (a[key] > b[key]) return -1;
                if (a[key] < b[key]) return 1;
                return 0;
            });
        }
    },
    daysFromDate(date, days) {
        if (!date) {
            date = new Date();
        }
        if (!days) {
            days = 0;
        }
        date.setDate(date.getDate() + days);
        return date;
    },
    startOfDay(date) {
        if (!date) {
            date = new Date();
        }
        date.setUTCHours(0, 0, 0, 0);
        return date;
    },
    endOfDay(date) {
        if (!date) {
            date = new Date();
        }
        date.setUTCHours(23, 59, 59, 999);
        return date;
    },
    startOfWeek(date) {
        if (!date) {
            date = new Date();
        }
        var day = date.getDay() || 7;
        if (day !== 1) {
            date.setHours(-24 * (day - 1));
        }
        return Utils.startOfDay(date);
    },
    startOfMonth(date) {
        if (!date) {
            date = new Date();
        }
        date = new Date(date.getFullYear(), date.getMonth(), 1);
        return Utils.startOfDay(date);
    },
    startOfYear(date) {
        if (!date) {
            date = new Date();
        }
        date = new Date(date.getFullYear(), 0, 1);
        return Utils.startOfDay(date);
    },
    round(number) {
        return Math.round((number + Number.EPSILON) * 100) / 100;
    },
    zeroPad: function (n, width, z) {
        n = Number(n);
        z = z || "0";
        n = n + "";
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    },
    chunkArray(array, chunkSize) {
        console.log("Chunking array");
        if (!chunkSize) {
            chunkSize = 10;
        }
        var chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        console.log("Chunked array");
        return chunks;
    },
    axiosRequest(parameters) {
        return new Promise(async function (resolve, reject) {
            try {
                console.log(`Making ${parameters.method} request`, parameters);
                var response = await axios({
                    method: parameters.method,
                    url: parameters.url,
                    data: parameters.data,
                    headers: parameters.headers
                });
                if (response.data.error) {
                    console.log(`${parameters.method} request failed`, {
                        status: response.status,
                        error: response.data.error
                    });
                    return reject({
                        status: response.status,
                        error: response.data.error
                    });
                } else {
                    console.log(`${parameters.method} request response`, {
                        status: response.status,
                        body: response.data
                    });
                    return resolve({
                        status: response.status,
                        body: response.data
                    });
                }
            } catch (error) {
                console.log(error.response.data);
                console.error(`${parameters.method} request failed`, {
                    status: error.response.status,
                    error: error.response.statusText
                });
                return reject({
                    status: error.response.status,
                    error: error.response.statusText
                });
            }
        });
    },
    encrypt: function (string) {
        console.log(cryptr.encrypt(string));
        return cryptr.encrypt(string);
    },
    decrypt: function (string) {
        console.log(cryptr.decrypt(string));
        return cryptr.decrypt(string);
    },
    getHoursBetweenDates: function (date1, date2) {
        return Math.abs(date1 - date2) / 36e5;
    },
    getDaysBewtweenDates: function (date1, date2) {
        return Math.ceil(Math.abs(date2 - date1) / (1000 * 60 * 60 * 24));
    },
    getWeeksBetweenDates: function (date1, date2) {
        return Math.abs(Math.round((date1 - date2) / (7 * 24 * 60 * 60 * 1000)));
    },
    getMonthsBetweenDates: function (date1, date2) {
        var mnths = (date1.getFullYear() - date2.getFullYear()) * 12;
        mnths += date1.getMonth() - date2.getMonth();
        return Math.abs(mnths);
    },
    getMonday: function (date) {
        var day = date.getDay() || 7;
        if (day !== 1) {
            date.setHours(-24 * (day - 1));
        }
        return date;
    },
    getSunday: function (date) {
        var day = date.getDay() || 7;
        if (day !== 1) {
            date.setHours(-24 * (day - 1));
        }
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 6);
    },
    randomNumber(length) {
        var result = "";
        var characters = "123456789";
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return Number(result);
    },
    randomString(length) {
        var result = "";
        var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    },
    saveJSON: async function (filename, data) {
        return new Promise(async function (resolve, reject) {
            fs.writeFile(`./model/${filename}.json`, JSON.stringify(data), (error) => {
                if (error) {
                    return reject(error);
                }
                return resolve();
            });
        });
    },
    readJSON: async function (filename) {
        return new Promise(async function (resolve, reject) {
            fs.readFile(`./model/${filename}.json`, (error, data) => {
                if (error) {
                    return reject(error);
                }
                return resolve(JSON.parse(data));
            });
        });
    }
};

function hasUppercaseLetter(string) {
    return /w*[A-Z]/g.test(string);
}

function hasLowercaseLetter(string) {
    return /[a-z]/g.test(string);
}

function hasNumber(string) {
    return /[1-9]/g.test(string);
}

function getClassSchema(name, propagate) {
    return new Promise(function (resolve, reject) {
        var query = new Parse.Schema(name);
        query
            .get()
            .then(async function (schema) {
                if (propagate) {
                    for (var key in schema.fields) {
                        if (schema.fields[key].type === "Pointer") {
                            schema.fields[key].fields = await getClassSchema(schema.fields[key].targetClass);
                        }
                    }
                }
                return resolve(schema);
            })
            .catch((error) => {
                console.error(error);
                return reject(error);
            });
    });
}

function removeParsePointers(object) {
    if (typeof object === "object" && !Array.isArray(object)) {
        for (var key in object) {
            if (key === "pointer") {
                object[key] = undefined;
                continue;
            }
            if (typeof object[key] === "object") {
                object[key] = removeParsePointers(object[key]);
            }
        }
    } else if (Array.isArray(object)) {
        for (var i = 0; i < object.length; i++) {
            if (object[i] === "pointer") {
                object[i] = undefined;
                continue;
            }
            if (typeof object[i] === "object") {
                object[i] = removeParsePointers(object[i]);
            }
        }
    }
    return object;
}

module.exports = Utils;
