"use strict";

require("dotenv").config();
const express = require("express");
const ParseServer = require("parse-server").ParseServer;
const ParseDashboard = require("parse-dashboard");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(
    cors({
        origin: "*",
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        preflightContinue: false,
        optionsSuccessStatus: 200
    })
);
app.use(express.json({ limit: `${process.env.REQUEST_SIZE}mb` }));

if (process.env.DASHBOARD_MOUNT) {
    console.log(`Mounting Parse Dashboard`);
    app.use(
        `/${process.env.DASHBOARD_MOUNT}`,
        new ParseDashboard(
            {
                apps: [
                    {
                        serverURL: `${process.env.SERVER_URL}/${process.env.PARSE_MOUNT}`,
                        appId: process.env.APP_ID,
                        masterKey: process.env.MASTER_KEY,
                        appName: process.env.APP_ID,
                        production: process.env.NODE_ENV === "production" ? true : false
                    }
                ],
                users: [
                    {
                        user: process.env.DASHBOARD_USERNAME,
                        pass: process.env.DASHBOARD_PASSWORD
                    }
                ],
                useEncryptedPasswords: false
            },
            {
                allowInsecureHTTP: true,
                cookieSessionSecret: "***"
            }
        )
    );
}

console.log(`Mounting Parse Server`);

app.use(
    `/${process.env.PARSE_MOUNT}`,
    new ParseServer({
        databaseURI: process.env.DATABASE_URI,
        appId: process.env.APP_ID,
        masterKey: process.env.MASTER_KEY,
        serverURL: `${process.env.SERVER_URL}/${process.env.PARSE_MOUNT}`
    })
);

Parse.CoreManager.set("USE_MASTER_KEY", true);

fs.readdir("./routes", function (error, files) {
    console.log(`Mounting routes`);
    files.forEach(function (file) {
        console.log(`Mounting ./routes/${file}`);
        app.use(`/${require(`./routes/${file}`).path}`, require(`./routes/${file}`).router);
    });
});

var server = require("http").createServer(app);
server.timeout = Number(process.env.REQUEST_TIMEOUT) * 1000;
server.listen(process.env.PORT, async function () {
    console.log(`Server started at ${process.env.SERVER_URL}:${process.env.PORT}`);
});
