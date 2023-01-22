import {spawn, spawnSync, execSync} from 'child_process'
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import * as WriteYaml from 'write-yaml-file'

const initCa = async (caPath: string, networkConf: any) => {
    
    var Admin = process.env.CA_ADMIN;
    var AdminPw = process.env.CA_ADMIN_PW;

    const fabricCaBin = path.resolve("binaries/fabric-ca-server");
    const fabricCaName = caPath.split("/").pop();

    const fabricCaNetConf = fabricCaName != undefined ? networkConf.certificateAuthorities[fabricCaName] : {};
    const fabricCaUrl = fabricCaNetConf.url; 
    const fabricCaPort = fabricCaUrl.split(":").pop();
    const https = fabricCaNetConf.httpOptions.verify;
    const fabricCaId = fabricCaNetConf.caName;
    const isTLS = fabricCaNetConf.tlsCa;

    if (isTLS){
        Admin = process.env.TLS_CA_ADMIN;
        AdminPw = process.env.TLS_CA_ADMIN_PW;
    }

    const fabricCaDB = fs.existsSync(caPath + "/fabric-ca-server.db");

    if (!fabricCaDB) {

        console.log(`${fabricCaName}: Initializing...`)
        console.log(Admin, AdminPw)
        const fabricCa = spawnSync(fabricCaBin, ["init", "-b", `${Admin}:${AdminPw}`] , {cwd: caPath});
        // using stderr, eventhough its not an error
        const logMessage = fabricCa.stderr.toString().split('\n').slice(-2).reverse().pop();

        console.log(`${fabricCaName}: ${logMessage}`);
    


    // Modifying The TLS CA Server Configuration
    const fabricCaConfPath = caPath + "/fabric-ca-server-config.yaml";
    const fabricCaConfExists = fs.existsSync(caPath + "/fabric-ca-server-config.yaml");

    if (!fabricCaConfExists) {
        console.log(`${fabricCaName} configuration file is missing.`)
    }

    const fabricCaContent = fs.readFileSync(fabricCaConfPath, 'utf8');

    const fabricCaConf = YAML.parse(fabricCaContent);

    fabricCaConf.port = Number(fabricCaPort);
    fabricCaConf.tls.enabled = https;
    fabricCaConf.ca.name = fabricCaId;

    if(isTLS){
    delete fabricCaConf.signing.profiles.ca;}
    else{
        const fabricCaAdminPath = path.resolve(caPath, "../../User/caAdmin/tls-msp/");
        fabricCaConf.tls.certfile = fabricCaAdminPath + "/signcerts/cert.pm" 
        fabricCaConf.tls.keyfile =fabricCaAdminPath + "/key.pem"
    }

    // remove old certificate after modifying the configuration

    const caMspPath = caPath + "/msp";
    const caCert = caPath + "/ca-cert.pem";

    fs.rmSync(caMspPath, { recursive: true, force: true });
    fs.rmSync(caCert, { force: true });

    WriteYaml.sync(fabricCaConfPath, fabricCaConf)

    console.log(`${fabricCaName}: Configuration done.`)

    }

}

const startCa = (caPath: string, networkConf: any) => {

    const fabricCaBin = path.resolve("binaries/fabric-ca-server");
    const fabricCaName = caPath.split("/").pop();
    const fabricCaNetConf = fabricCaName != undefined ? networkConf.certificateAuthorities[fabricCaName] : {};
    const isTLS = fabricCaNetConf.tlsCa;

    const fabricCa = spawn(fabricCaBin, ["start"], {cwd: caPath});

    fabricCa.on("spawn", ()=>{
    // if tls, copy the tls ca cert to the admin tls
    if(isTLS){
        const fabricCaCertPath = caPath + "/ca-cert.pem";
        const fabricCaTlsAdminCertPath = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem")
        setTimeout(function() {
            fs.copyFileSync(fabricCaCertPath, fabricCaTlsAdminCertPath)
            const fabricCaAdminCertPath = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem")
            const fabricCaAdminMspPath = path.resolve(caPath, "../../User/tlsAdmin/msp")
            enrollUser(caPath, process.env.TLS_CA_ADMIN!, process.env.TLS_CA_ADMIN_PW!, fabricCaAdminCertPath, 
                fabricCaAdminMspPath, true, networkConf)
        },1000);
     }
    else{
        setTimeout(function() {
        const fabricCaAdminCertPath = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem"); //to change -> User/caAdmin
        const fabricCaAdminMspPath = path.resolve(caPath, "../../User/caAdmin/msp");
        enrollUser(caPath, process.env.CA_ADMIN!, process.env.CA_ADMIN_PW!, fabricCaAdminCertPath, 
            fabricCaAdminMspPath, false, networkConf);
        }, 1000);
    }
    console.log(`${fabricCaName}: Server Started.`)

    });
    // fabricCa.stderr.on("data", (data) =>{
    //     console.log(`${fabricCaName}: ${data}.`)
    // });
    return fabricCa;
}

function registerUser(caPath: string, id:string, pw:string, CertificateDir: string, networkConf: any){

    const fabricCaClientBin = path.resolve("binaries/fabric-ca-client");
    const fabricCaName = caPath.split("/").pop();

    const fabricCaNetConf = fabricCaName != undefined ? networkConf.certificateAuthorities[fabricCaName] : {};
    const fabricCaUrl = fabricCaNetConf.url;

    const fabricCaAdminCertPath = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem"); //to change -> User/caAdmin

    const args = ["register", "-d", "--id.name", id, "--id.secret", pw, "-u", fabricCaUrl, "--tls.certfiles", fabricCaAdminCertPath, "--mspdir", CertificateDir];

    const fabricCaClientPath =  path.resolve(caPath, "../../fabric-ca-client"); //double check might not be needed

    console.log(CertificateDir)
    const fabricCaClient = spawnSync(fabricCaClientBin, args , {cwd: fabricCaClientPath});

    // console.log(fabricCaClient.stderr.toString())
    
    console.log(`${fabricCaName}: user ${id} has been registered.`);

      // ./fabric-ca-client register -d --id.name rcaadmin --id.secret rcaadminpw -u https://my-machine.example.com:7054 --tls.certfiles tls-root-cert/tls-ca-cert.pem --mspdir tls-ca/tlsadmin/msp


}

function enrollUser(caPath: string, id:string, pw:string, tlsRootCertificateDir: string, outCertificateDir: string, tlsCa: boolean, networkConf: any){
    const fabricCaClientBin = path.resolve("binaries/fabric-ca-client");
    const fabricCaName = caPath.split("/").pop();

    const fabricCaNetConf = fabricCaName != undefined ? networkConf.certificateAuthorities[fabricCaName] : {};
    const fabricCaUrl = fabricCaNetConf.url.split("//").pop();

    const fabricCaClientPath =  path.resolve(caPath, "../../fabric-ca-client"); //double check might not be needed

    const args = ["enroll", "-d", "-u", `https://${id}:${pw}@${fabricCaUrl}`, "--tls.certfiles", tlsRootCertificateDir, "--mspdir", outCertificateDir]
    if(tlsCa){
        args.push( "--enrollment.profile", "tls");
    }
    
    const fabricCaClient = spawnSync(fabricCaClientBin, args , {cwd: fabricCaClientPath});

    //renaming key file 
    if(tlsCa){
    const tlsKeysPath = path.resolve(outCertificateDir, "keystore"); 
    const tlsKeys = fs.readdirSync(tlsKeysPath);
    
    if(tlsKeys){
        const oldTlsKey = tlsKeysPath + "/" + tlsKeys.pop();
        const newTlsKey = tlsKeysPath + "/key.pem";
        fs.renameSync(oldTlsKey, newTlsKey);
    }

    }

    console.log(`${fabricCaName}: user ${id} has been enrolled.`)
    // console.log(fabricCaClient.stderr.toString())
}


function initPeer(peerPath: string, networkConf: any){
    // const fabricCaBin = path.resolve("binaries/fabric-ca-server");
    const peerName = peerPath.split("/").pop();

    const peerNetConf = peerName != undefined ? networkConf.peers[peerName] : {};

    const peerUrl = peerNetConf.url.split(":");

    const peerPort = Number(peerUrl.pop());  

    const chainCodeUrlPort = peerPort + 1;

    const chainCodeUrl = peerUrl.join(":") + ":" + chainCodeUrlPort;

    const networkId = "test";

    const orgName = path.resolve(peerPath, "../..").split("/").pop();

    const mspId = orgName != undefined ? networkConf.organizations[orgName].mspid : {};

    const fileSystmePath = path.resolve(peerPath, "var/hyperledger/production");

    const bootsrapUrl = peerNetConf.url; //TODO: list of addresses

    const endPointUrl = peerNetConf.url;

    const externalEndpointUrl = peerNetConf.url;

    const tlsEnabled = true;

    const tlsCertPath = path.resolve(peerPath, "tls/signcerts/cert.pem");

    const tlsKeyPath = path.resolve(peerPath, "tls/keystore/key.pem");

    const tlsCertRootPath = path.resolve(peerPath, "tls/tlscacerts/.pem"); //TODO: rename rootcert

    const peerStatePath = path.resolve(peerPath, "var/hyperledger/production/snapshots");
    
    const peerCorePath = peerPath + "/core.yaml";

    const peerCoreContent = fs.readFileSync(peerCorePath, 'utf8');

    const peerCore = YAML.parse(peerCoreContent);

    peerCore.peer.id = peerName;
    peerCore.peer.networkId = networkId;
    peerCore.peer.listenAddress = peerNetConf.url;
    peerCore.peer.address = peerNetConf.url;
    peerCore.peer.chaincodeListenAddress = chainCodeUrl;
    peerCore.peer.localMspId = mspId;
    peerCore.peer.fileSystemPath = fileSystmePath;
    peerCore.peer.gossip.bootstrap = bootsrapUrl;
    peerCore.peer.gossip.endpoint = endPointUrl;
    peerCore.peer.gossip.externalEndpoint = externalEndpointUrl;
    peerCore.peer.tls.enabled = tlsEnabled;
    peerCore.peer.tls.cert.file = tlsCertPath;
    peerCore.peer.tls.key.file = tlsKeyPath;
    peerCore.peer.tls.rootcert.file = tlsCertRootPath;
    peerCore.ledger.snapshots.rootDir = peerStatePath;

    console.log(peerName, peerUrl, peerPort, chainCodeUrlPort, orgName, mspId, chainCodeUrl);

    WriteYaml.sync(peerCorePath, peerCore);

}


export{
    initCa,
    startCa,
    registerUser,
    enrollUser,
    initPeer
}