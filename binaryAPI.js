"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.initPeer = exports.enrollUser = exports.registerUser = exports.startCa = exports.initCa = void 0;
var child_process_1 = require("child_process");
var fs = require("fs");
var path = require("path");
var YAML = require("yaml");
var WriteYaml = require("write-yaml-file");
var initCa = function (caPath, networkConf) { return __awaiter(void 0, void 0, void 0, function () {
    var Admin, AdminPw, fabricCaBin, fabricCaName, fabricCaNetConf, fabricCaUrl, fabricCaPort, https, fabricCaId, isTLS, fabricCaDB, fabricCa, logMessage, fabricCaConfPath, fabricCaConfExists, fabricCaContent, fabricCaConf, fabricCaAdminPath, caMspPath, caCert;
    return __generator(this, function (_a) {
        Admin = process.env.CA_ADMIN;
        AdminPw = process.env.CA_ADMIN_PW;
        fabricCaBin = path.resolve("binaries/fabric-ca-server");
        fabricCaName = caPath.split("/").pop();
        fabricCaNetConf = fabricCaName != undefined ? networkConf.certificateAuthorities[fabricCaName] : {};
        fabricCaUrl = fabricCaNetConf.url;
        fabricCaPort = fabricCaUrl.split(":").pop();
        https = fabricCaNetConf.httpOptions.verify;
        fabricCaId = fabricCaNetConf.caName;
        isTLS = fabricCaNetConf.tlsCa;
        if (isTLS) {
            Admin = process.env.TLS_CA_ADMIN;
            AdminPw = process.env.TLS_CA_ADMIN_PW;
        }
        fabricCaDB = fs.existsSync(caPath + "/fabric-ca-server.db");
        if (!fabricCaDB) {
            console.log("".concat(fabricCaName, ": Initializing..."));
            console.log(Admin, AdminPw);
            fabricCa = (0, child_process_1.spawnSync)(fabricCaBin, ["init", "-b", "".concat(Admin, ":").concat(AdminPw)], { cwd: caPath });
            logMessage = fabricCa.stderr.toString().split('\n').slice(-2).reverse().pop();
            console.log("".concat(fabricCaName, ": ").concat(logMessage));
            fabricCaConfPath = caPath + "/fabric-ca-server-config.yaml";
            fabricCaConfExists = fs.existsSync(caPath + "/fabric-ca-server-config.yaml");
            if (!fabricCaConfExists) {
                console.log("".concat(fabricCaName, " configuration file is missing."));
            }
            fabricCaContent = fs.readFileSync(fabricCaConfPath, 'utf8');
            fabricCaConf = YAML.parse(fabricCaContent);
            fabricCaConf.port = Number(fabricCaPort);
            fabricCaConf.tls.enabled = https;
            fabricCaConf.ca.name = fabricCaId;
            if (isTLS) {
                delete fabricCaConf.signing.profiles.ca;
            }
            else {
                fabricCaAdminPath = path.resolve(caPath, "../../User/caAdmin/tls-msp/");
                fabricCaConf.tls.certfile = fabricCaAdminPath + "/signcerts/cert.pm";
                fabricCaConf.tls.keyfile = fabricCaAdminPath + "/key.pem";
            }
            caMspPath = caPath + "/msp";
            caCert = caPath + "/ca-cert.pem";
            fs.rmSync(caMspPath, { recursive: true, force: true });
            fs.rmSync(caCert, { force: true });
            WriteYaml.sync(fabricCaConfPath, fabricCaConf);
            console.log("".concat(fabricCaName, ": Configuration done."));
        }
        return [2 /*return*/];
    });
}); };
exports.initCa = initCa;
var startCa = function (caPath, networkConf) {
    var fabricCaBin = path.resolve("binaries/fabric-ca-server");
    var fabricCaName = caPath.split("/").pop();
    var fabricCaNetConf = fabricCaName != undefined ? networkConf.certificateAuthorities[fabricCaName] : {};
    var isTLS = fabricCaNetConf.tlsCa;
    var fabricCa = (0, child_process_1.spawn)(fabricCaBin, ["start"], { cwd: caPath });
    fabricCa.on("spawn", function () {
        // if tls, copy the tls ca cert to the admin tls
        if (isTLS) {
            var fabricCaCertPath_1 = caPath + "/ca-cert.pem";
            var fabricCaTlsAdminCertPath_1 = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem");
            setTimeout(function () {
                fs.copyFileSync(fabricCaCertPath_1, fabricCaTlsAdminCertPath_1);
                var fabricCaAdminCertPath = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem");
                var fabricCaAdminMspPath = path.resolve(caPath, "../../User/tlsAdmin/msp");
                enrollUser(caPath, process.env.TLS_CA_ADMIN, process.env.TLS_CA_ADMIN_PW, fabricCaAdminCertPath, fabricCaAdminMspPath, true, networkConf);
            }, 1000);
        }
        else {
            setTimeout(function () {
                var fabricCaAdminCertPath = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem"); //to change -> User/caAdmin
                var fabricCaAdminMspPath = path.resolve(caPath, "../../User/caAdmin/msp");
                enrollUser(caPath, process.env.CA_ADMIN, process.env.CA_ADMIN_PW, fabricCaAdminCertPath, fabricCaAdminMspPath, false, networkConf);
            }, 1000);
        }
        console.log("".concat(fabricCaName, ": Server Started."));
    });
    // fabricCa.stderr.on("data", (data) =>{
    //     console.log(`${fabricCaName}: ${data}.`)
    // });
    return fabricCa;
};
exports.startCa = startCa;
function registerUser(caPath, id, pw, CertificateDir, networkConf) {
    var fabricCaClientBin = path.resolve("binaries/fabric-ca-client");
    var fabricCaName = caPath.split("/").pop();
    var fabricCaNetConf = fabricCaName != undefined ? networkConf.certificateAuthorities[fabricCaName] : {};
    var fabricCaUrl = fabricCaNetConf.url;
    var fabricCaAdminCertPath = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem"); //to change -> User/caAdmin
    var args = ["register", "-d", "--id.name", id, "--id.secret", pw, "-u", fabricCaUrl, "--tls.certfiles", fabricCaAdminCertPath, "--mspdir", CertificateDir];
    var fabricCaClientPath = path.resolve(caPath, "../../fabric-ca-client"); //double check might not be needed
    console.log(CertificateDir);
    var fabricCaClient = (0, child_process_1.spawnSync)(fabricCaClientBin, args, { cwd: fabricCaClientPath });
    // console.log(fabricCaClient.stderr.toString())
    console.log("".concat(fabricCaName, ": user ").concat(id, " has been registered."));
    // ./fabric-ca-client register -d --id.name rcaadmin --id.secret rcaadminpw -u https://my-machine.example.com:7054 --tls.certfiles tls-root-cert/tls-ca-cert.pem --mspdir tls-ca/tlsadmin/msp
}
exports.registerUser = registerUser;
function enrollUser(caPath, id, pw, tlsRootCertificateDir, outCertificateDir, tlsCa, networkConf) {
    var fabricCaClientBin = path.resolve("binaries/fabric-ca-client");
    var fabricCaName = caPath.split("/").pop();
    var fabricCaNetConf = fabricCaName != undefined ? networkConf.certificateAuthorities[fabricCaName] : {};
    var fabricCaUrl = fabricCaNetConf.url.split("//").pop();
    var fabricCaClientPath = path.resolve(caPath, "../../fabric-ca-client"); //double check might not be needed
    var args = ["enroll", "-d", "-u", "https://".concat(id, ":").concat(pw, "@").concat(fabricCaUrl), "--tls.certfiles", tlsRootCertificateDir, "--mspdir", outCertificateDir];
    if (tlsCa) {
        args.push("--enrollment.profile", "tls");
    }
    var fabricCaClient = (0, child_process_1.spawnSync)(fabricCaClientBin, args, { cwd: fabricCaClientPath });
    //renaming key file 
    if (tlsCa) {
        var tlsKeysPath = path.resolve(outCertificateDir, "keystore");
        var tlsKeys = fs.readdirSync(tlsKeysPath);
        if (tlsKeys) {
            var oldTlsKey = tlsKeysPath + "/" + tlsKeys.pop();
            var newTlsKey = tlsKeysPath + "/key.pem";
            fs.renameSync(oldTlsKey, newTlsKey);
        }
    }
    console.log("".concat(fabricCaName, ": user ").concat(id, " has been enrolled."));
    // console.log(fabricCaClient.stderr.toString())
}
exports.enrollUser = enrollUser;
function initPeer(peerPath, networkConf) {
    // const fabricCaBin = path.resolve("binaries/fabric-ca-server");
    var peerName = peerPath.split("/").pop();
    var peerNetConf = peerName != undefined ? networkConf.peers[peerName] : {};
    var peerUrl = peerNetConf.url.split(":");
    var peerPort = Number(peerUrl.pop());
    var chainCodeUrlPort = peerPort + 1;
    var networkId = "test";
    var orgName = path.resolve(peerPath, "../..");
    var mspId = orgName != undefined ? networkConf.organizations : {};
    var fileSystmePath = path.resolve(peerPath, "var/hyperledger/production");
    var bootsrapUrl = peerNetConf.url; //TODO: list of addresses
    var endPointUrl = peerNetConf.url;
    var externalEndpointUrl = peerNetConf.url;
    var tlsEnabled = true;
    var tlsCertPath = path.resolve(peerPath, "tls/signcerts/cert.pem");
    var tlsKeyPath = path.resolve(peerPath, "tls/keystore/key.pem");
    var tlsCertRootPath = path.resolve(peerPath, "tls/tlscacerts/.pem"); //TODO: rename rootcert
    var peerStatePath = path.resolve(peerPath, "/var/hyperledger/production/snapshots");
    var peerCorePath = peerPath + "/core.yaml";
    var peerCoreContent = fs.readFileSync(peerCorePath, 'utf8');
    var peerCore = YAML.parse(peerCoreContent);
    peerCore.peer.id = peerName;
    peerCore.peer.networkId = networkId;
    peerCore.peer.listenAddress = peerNetConf.url;
    peerCore.peer.chaincodeListenAddress =
        console.log(peerName, peerUrl, peerPort, chainCodeUrlPort, orgName, mspId);
    // WriteYaml.sync(peerCorePath, fabricCaConf);
}
exports.initPeer = initPeer;
