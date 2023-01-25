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
    const fabricCaUrl = new URL(fabricCaNetConf.url); 
    const fabricCaPort = Number(fabricCaUrl.port);
    const fabricCaOperationPort = fabricCaPort + 2;
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

    fabricCaConf.port = fabricCaPort;
    fabricCaConf.tls.enabled = https;
    fabricCaConf.ca.name = fabricCaId;
    fabricCaConf.csr.hosts = [fabricCaName, fabricCaUrl.hostname]
    fabricCaConf.operations.listenAddress = "127.0.0.1" + ":" + fabricCaOperationPort

    if(isTLS){
    delete fabricCaConf.signing.profiles.ca;}
    else{
        const fabricCaAdminPath = path.resolve(caPath, "../../User/caAdmin/tls/");
        fabricCaConf.tls.certfile = fabricCaAdminPath + "/signcerts/cert.pem" 
        fabricCaConf.tls.keyfile = fabricCaAdminPath + "/keystore/key.pem"
    }

    // remove old certificate after modifying the configuration

    const caMspPath = caPath + "/msp";
    const caCert = caPath + "/ca-cert.pem";

    fs.rmSync(caMspPath, { recursive: true, force: true });
    fs.rmSync(caCert, { force: true });

    WriteYaml.sync(fabricCaConfPath, fabricCaConf);

    console.log(`${fabricCaName}: Configuration done.`)

    }

}

const startCa = async (caPath: string, networkConf: any) => {

    const fabricCaBin = path.resolve("binaries/fabric-ca-server");
    const fabricCaName = caPath.split("/").pop();
    const fabricCaNetConf = fabricCaName != undefined ? networkConf.certificateAuthorities[fabricCaName] : {};
    const isTLS = fabricCaNetConf.tlsCa;

    const fabricCa = spawn(fabricCaBin, ["start"], {cwd: caPath});

    // fabricCa.stderr.on("data", (data) => {console.log(`${fabricCaName}: ${data}`)})
    // fabricCa.stderr.on("data", (data) =>{
    //     console.log(`${fabricCaName}: ${data}.`)
    // });

    return new Promise<void>((res, rej) => {
        fabricCa.stderr.on("data", (data) => {
            if (data.includes("[INFO] Listening on")){
                console.log(`${fabricCaName}: started`);
                if(isTLS){
                        const fabricCaCertPath = caPath + "/ca-cert.pem";
                        const fabricCaTlsAdminCertPath = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem")
                        fs.copyFileSync(fabricCaCertPath, fabricCaTlsAdminCertPath)
                        const fabricCaAdminCertPath = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem")
                        const fabricCaAdminMspPath = path.resolve(caPath, "../../User/tlsAdmin/msp")
                        enrollUser(caPath, process.env.TLS_CA_ADMIN!, process.env.TLS_CA_ADMIN_PW!, 
                            fabricCaAdminMspPath, true, networkConf);
                    }
                    else{
                        const fabricCaAdminCertPath = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem"); //to change -> User/caAdmin
                        const fabricCaAdminMspPath = path.resolve(caPath, "../../User/caAdmin/msp");
                        enrollUser(caPath, process.env.CA_ADMIN!, process.env.CA_ADMIN_PW!, 
                            fabricCaAdminMspPath, false, networkConf);
                        const orgMspDir = path.resolve(caPath, "../../msp/ca-cert.pem");
                        console.log(orgMspDir)
                        fs.copyFileSync(caPath + "/ca-cert.pem", orgMspDir) //copying the ca cert to the org msp
                    }
                res();
            }
        })
    });
}

function registerUser(caPath: string, id:string, pw:string, CertificateDir: string, networkConf: any){

    const fabricCaClientBin = path.resolve("binaries/fabric-ca-client");
    const fabricCaName = caPath.split("/").pop();

    const fabricCaNetConf = fabricCaName != undefined ? networkConf.certificateAuthorities[fabricCaName] : {};
    const fabricCaUrl = new URL(fabricCaNetConf.url);

    const tlsRootCertificateDir = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem"); //to change -> User/caAdmin

    const args = ["register", "-d", "--id.name", id, "--id.secret", pw, "-u", fabricCaUrl.toString().slice(0,-1), "--tls.certfiles", tlsRootCertificateDir, "--mspdir", CertificateDir];

    const fabricCaClientPath =  path.resolve(caPath, "../../fabric-ca-client"); //double check might not be needed
  
    const fabricCaClient = spawnSync(fabricCaClientBin, args , {cwd: fabricCaClientPath});

    console.log(`${fabricCaName}: user ${id} has been registered.`);

    // console.log("REG ", fabricCaClient.stderr.toString())
      // ./fabric-ca-client register -d --id.name rcaadmin --id.secret rcaadminpw -u https://my-machine.example.com:7054 --tls.certfiles tls-root-cert/tls-ca-cert.pem --mspdir tls-ca/tlsadmin/msp


}

function enrollUser(caPath: string, id:string, pw:string, outCertificateDir: string, tlsCa: boolean, networkConf: any){
    const fabricCaClientBin = path.resolve("binaries/fabric-ca-client");
    const fabricCaName = caPath.split("/").pop();

    const fabricCaNetConf = fabricCaName != undefined ? networkConf.certificateAuthorities[fabricCaName] : {};
    const fabricCaUrl = new URL(fabricCaNetConf.url);
    const fabricCaHosts = [fabricCaName, fabricCaUrl.hostname];


    const fabricCaClientPath =  path.resolve(caPath, "../../fabric-ca-client"); //double check might not be needed

    const tlsRootCertificateDir = path.resolve(caPath, "../../User/tlsAdmin/tls-root-cert/tls-ca-cert.pem"); //to change -> User/caAdmin

    const args = ["enroll", "-d", "-u", `https://${id}:${pw}@${fabricCaUrl.host}`, "--tls.certfiles", tlsRootCertificateDir, "--mspdir", outCertificateDir, "--csr.hosts", fabricCaHosts.join(",")]
    if(tlsCa){
        args.push( "--enrollment.profile", "tls");
    }
    
    const fabricCaClient = spawnSync(fabricCaClientBin, args , {cwd: fabricCaClientPath});
    // console.log(fabricCaClient.stderr.toString())
    //renaming key file 
    if(tlsCa){
    const tlsKeysPath = path.resolve(outCertificateDir, "keystore"); 
    const tlsKeys = fs.readdirSync(tlsKeysPath);
    
    if(tlsKeys){
        const oldTlsKey = tlsKeysPath + "/" + tlsKeys.pop();
        const newTlsKey = tlsKeysPath + "/key.pem";
        fs.renameSync(oldTlsKey, newTlsKey);
    }

    const tlsRootCertPath = path.resolve(outCertificateDir, "tlscacerts"); 
    const tlsRoots = fs.readdirSync(tlsRootCertPath);

    if(tlsRoots){
        const oldTlsRoot = tlsRootCertPath + "/" + tlsRoots.pop();
        const newTlsRoot = tlsRootCertPath + "/tls-ca-cert.pem";
        fs.renameSync(oldTlsRoot, newTlsRoot);
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

    const bootsrapUrl = new URL(peerNetConf.url).host; //TODO: list of addresses

    const endPointUrl = new URL(peerNetConf.url).host;

    const externalEndpointUrl = new URL(peerNetConf.url).host;

    const tlsEnabled = true;

    const tlsCertPath = path.resolve(peerPath, "tls/signcerts/cert.pem");

    const tlsKeyPath = path.resolve(peerPath, "tls/keystore/key.pem");

    const tlsCertRootPath = path.resolve(peerPath, "tls/tlscacerts/tls-ca-cert.pem");

    const peerStatePath = path.resolve(peerPath, "var/hyperledger/production/snapshots");
    
    const peerCorePath = peerPath + "/core.yaml";

    const peerCoreContent = fs.readFileSync(peerCorePath, 'utf8');

    const peerCore = YAML.parse(peerCoreContent);

    peerCore.peer.id = peerName;
    peerCore.peer.networkId = networkId;
    peerCore.peer.listenAddress = new URL(peerNetConf.url).host;
    peerCore.peer.address = new URL(peerNetConf.url).host;
    peerCore.peer.chaincodeListenAddress = new URL(chainCodeUrl).host;
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

    const binaryDirectory = path.resolve("binaries");

    fs.copyFileSync(binaryDirectory + "/config/config.yaml", peerPath + "/msp/config.yaml");

    // console.log(peerName, peerUrl, peerPort, chainCodeUrlPort, orgName, mspId, chainCodeUrl);

    WriteYaml.sync(peerCorePath, peerCore);

}

function startPeer(peerPath: string, networkConf: any){

    const peerName = peerPath.split("/").pop();

    const fabricCaClientBin = path.resolve("binaries/peer");
    const peerNode = spawn(fabricCaClientBin, ["node", "start"], {cwd: peerPath, env: {'FABRIC_CFG_PATH': peerPath}});

    peerNode.stderr.on("data", (data)=>{
        if (data.includes("ERRO")){
            throw console.error(`Peer did not start. Error: ${data}`);
        }
    });

    console.log(`${peerName}: Started.`)
}

function initOrder(orderPath: string, networkConf: any){
    
    const ordererName = orderPath.split("/").pop();
    const ordererNetConf = ordererName != undefined ? networkConf.orderers[ordererName] : {};

    const ordererConfPath = path.resolve("binaries/config/orderer.yaml");

    fs.copyFileSync(ordererConfPath, orderPath + "/orderer.yaml");

    const ordererConfContent = fs.readFileSync(orderPath + "/orderer.yaml", 'utf8');

    const ordererConf = YAML.parse(ordererConfContent);

    const ordererUrl =  new URL(ordererNetConf.url)

    const orgName = path.resolve(orderPath, "../..").split("/").pop();
    
    ordererConf.General.ListenAddress = ordererUrl.hostname;
    ordererConf.General.ListenPort = ordererUrl.port;
    ordererConf.General.TLS.enabled = true
    ordererConf.General.TLS.PrivateKey = path.resolve(orderPath, "tls/keystore/key.pem");
    ordererConf.General.TLS.Certificate = path.resolve(orderPath, "tls/signcerts/cert.pem");
    delete ordererConf.General.TLS.RootCAs;
    ordererConf.General.LocalMSPID != undefined ? networkConf.organizations[orgName!].mspid : {};
    ordererConf.FileLedger = path.resolve(orderPath, "/var/hyperledger/production/orderer");

    
}





export{
    initCa,
    startCa,
    registerUser,
    enrollUser,
    initPeer,
    startPeer
}