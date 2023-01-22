"use strict";
exports.__esModule = true;
exports.createBinaries = exports.createDirectory = void 0;
var fs = require("fs");
var createDirectory = function (directoryPath) {
    var directoryPathExists = fs.existsSync(directoryPath);
    if (!directoryPathExists) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
};
exports.createDirectory = createDirectory;
var createBinaries = function (binaryPath, destination, binary) {
    fs.copyFileSync(binaryPath + "/".concat(binary), destination + "/".concat(binary));
};
exports.createBinaries = createBinaries;
