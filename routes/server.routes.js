const express = require("express");
const router = express.Router();

router.get("/", async function (req, res) {
    return res.status(200).send(process.env.APP_ID);
});

module.exports = {
    path: "",
    router
};
