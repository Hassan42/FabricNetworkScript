import * as YAML from 'yaml'
import * as path from 'path';
import * as fs from 'fs';

import * as dotenv from 'dotenv'

import * as utils from './utils';
import * as bashApi from './binaryAPI';

import * as fabricClient from 'fabric-client';
import * as fabricCaClient from 'fabric-ca-client';
import * as fabricNetwork from 'fabric-network';


function readNetworkConf() {
  
  const networkConfPath = path.resolve("connection.yaml");
  
  const fileExists = fs.existsSync(networkConfPath);
    if (!fileExists) {
        throw new Error(`no such file or directory: ${networkConfPath}`);
    }

  const networkConfContent = fs.readFileSync(networkConfPath, 'utf8');

  const networkConf = YAML.parse(networkConfContent);

  console.log(`Network Configuration Loaded.`);

  return networkConf;
}

function buildNetwork(networkConf: any){

  const networkPath = path.resolve("network");
  const binaryDirectory = path.resolve("binaries");

  utils.createDirectory(networkPath);

  Object.keys(networkConf.organizations).forEach(organizationKey => {

    const orginization = networkConf.organizations[organizationKey];

    const orginizationPath = path.resolve("network", organizationKey);

    utils.createDirectory(orginizationPath);

    const orginizationMspPath = path.resolve("network", organizationKey, "Msp");

    utils.createDirectory(orginizationMspPath);

    const orginizationUserPath = path.resolve("network", organizationKey, "User");

    utils.createDirectory(orginizationUserPath);

    if('peers' in orginization){
    orginization.peers.forEach((peer: string) => {
      const peerPath = path.resolve("network", organizationKey, `Peers/${peer}`);
      const peerMspPath = path.resolve("network", organizationKey, `Peers/${peer}/msp`);
      const peerTlsPath = path.resolve("network", organizationKey, `Peers/${peer}/tls`);
      const peerBinaryPath = path.resolve("network",organizationKey,"Peers", peer, "bin");
      const oldPeerCoreFilePath = path.resolve("binaries/config/core.yaml");
      const newPeerCorefilePath = path.resolve("network", organizationKey, `Peers/${peer}/core.yaml`);


      utils.createDirectory(peerPath);
      utils.createDirectory(peerMspPath);
      utils.createDirectory(peerTlsPath);
      utils.createDirectory(peerBinaryPath);

      fs.copyFileSync(oldPeerCoreFilePath, newPeerCorefilePath);
      // utils.createBinaries(binaryDirectory, peerBinaryPath, "peer");
    });}
    
    if('certificateAuthorities' in orginization){
    orginization.certificateAuthorities.forEach((ca: string) => {
      const caPath = path.resolve("network", organizationKey, `Cas/${ca}`);
      utils.createDirectory(caPath);

      // utils.createBinaries(binaryDirectory, caPath, "fabric-ca-server");
    });}

    const tlsAdminPath = path.resolve("network", organizationKey, "User", "tlsAdmin");
    const caAdminPath = path.resolve("network", organizationKey, "User", "caAdmin");

    utils.createDirectory(tlsAdminPath);
    utils.createDirectory(caAdminPath);

    const tlsAdminRootCertPath = path.resolve("network", organizationKey, "User", "tlsAdmin/tls-root-cert");
    // const tlsAdminCertPath = path.resolve("network", organizationKey, "User", "tlsAdmin/tls-ca");

    utils.createDirectory(tlsAdminRootCertPath);
    // utils.createDirectory(tlsAdminCertPath);

    const caAdminTlsCertPath = path.resolve("network", organizationKey, "User", "caAdmin/tls-msp");
    utils.createDirectory(caAdminTlsCertPath);

    const fabricCaClientPath = path.resolve("network", organizationKey, "fabric-ca-client");
    utils.createDirectory(fabricCaClientPath);

  });

}


async function getUserContext(userId: string, identity: fabricNetwork.Identity , wallet: fabricNetwork.Wallet){

  const provider = wallet.getProviderRegistry().getProvider("X.509");

  const user = await provider.getUserContext(identity, userId);

  return user;

}

const tlsCaAdminId = "tlsadmin";
const tlsCaAdminPass = "tlsadminpw";
const walletPath = path.resolve("wallet");  

async function main() {

  dotenv.config()

  const networkConf = readNetworkConf();

  buildNetwork(networkConf);

  // Setting Up CAs

  bashApi.initCa("/Users/hassanatwi/fabric-network-script/network/Org1/Cas/tlsca.org1.example.com", networkConf);

  const fabricTlsCaServer = bashApi.startCa("/Users/hassanatwi/fabric-network-script/network/Org1/Cas/tlsca.org1.example.com", networkConf);

  fabricTlsCaServer.on("spawn", ()=>{
    setTimeout(function(){
      bashApi.registerUser("/Users/hassanatwi/fabric-network-script/network/Org1/Cas/tlsca.org1.example.com", process.env.CA_ADMIN!, process.env.CA_ADMIN_PW!, "/Users/hassanatwi/fabric-network-script/network/Org1/User/tlsAdmin/msp"
      , networkConf);
      
      bashApi.enrollUser("/Users/hassanatwi/fabric-network-script/network/Org1/Cas/tlsca.org1.example.com", process.env.CA_ADMIN!, process.env.CA_ADMIN_PW!, "/Users/hassanatwi/fabric-network-script/network/Org1/User/tlsAdmin/tls-root-cert/tls-ca-cert.pem"
      , "/Users/hassanatwi/fabric-network-script/network/Org1/User/caAdmin/tls-msp" , true, networkConf);
    }, 1000)

  })
  
  bashApi.initCa("/Users/hassanatwi/fabric-network-script/network/Org1/Cas/ca.org1.example.com", networkConf);

  const fabricCaServer = bashApi.startCa("/Users/hassanatwi/fabric-network-script/network/Org1/Cas/ca.org1.example.com", networkConf);

  bashApi.initPeer("/Users/hassanatwi/fabric-network-script/network/Org1/Peers/peer0.org1.example.com", networkConf)

  // Setting Up Peers


  

  // fabricTlsCaServer.stderr.on("data", (data) =>{
  //   console.log(`"tlsca: ${data}.`)
  // });

  // ./fabric-ca-client register -d --id.name rcaadmin --id.secret rcaadminpw -u https://my-machine.example.com:7054 --tls.certfiles tls-root-cert/tls-ca-cert.pem --mspdir tls-ca/tlsadmin/msp

  // const Admin = process.env.TLS_CA_ADMIN!;
  // const AdminPw = process.env.TLS_CA_ADMIN_PW!;

  // fabricCaServer.on("spawn", ()=>{
  //   setTimeout(function() {
  //     bashApi.enrollUser("/Users/hassanatwi/fabric-network-script/network/Org1/Cas/ca.org1.example.com", Admin, AdminPw, "/Users/hassanatwi/fabric-network-script/network/Org1/User/tlsAdmin/tls-root-cert/tls-ca-cert.pem", 
  //     "/Users/hassanatwi/fabric-network-script/network/Org1/User/tlsAdmin/msp", true, networkConf)
  //   }, 1000);
  // })
 

  // const network : Network = readNetwork();

  // const caUrl = network.cas[0].url;

  // const caCert = network.cas[0].tlsCert;

  // const caName = network.cas[0].name;

  // const tlsCaClient = new fabricCaClient.default(caUrl, { trustedRoots: caCert, verify: false },  caName);

  // const certificate = await tlsCaClient.enroll({enrollmentID: tlsCaAdminId , enrollmentSecret: tlsCaAdminPass});
  
  // const walletIdentity = {
  //   credentials: {
  //     certificate: certificate.certificate,
  //     privateKey: certificate.key.toBytes(),
  //   },
  //   mspId: 'org1',
  //   type: 'X.509',
  // }

  // const wallet = await fabricNetwork.Wallets.newFileSystemWallet(walletPath);

  // wallet.put(tlsCaAdminId, walletIdentity);

  // const tlsCaAdmin = await getUserContext(tlsCaAdminId, walletIdentity, wallet);

  // // tlsCaClient.register(,) register
  // // enroll
  // // add tls certificate to the wallet

  // // create new fabric ca client 
  // // register peer + tls
  // // enroll peer + tls

  // // same for orderer
  // // Create a client
  // // Create a channel 



  // console.log(tlsCaAdmin)
  
}

main()