import * as fs from 'fs';

const createDirectory = (directoryPath: string) => {
    const directoryPathExists = fs.existsSync(directoryPath);
    if (!directoryPathExists) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }
};

const createBinaries = (binaryPath: string, destination: string, binary: string) => {
    fs.copyFileSync(binaryPath + `/${binary}`, destination+`/${binary}`)
}

export{
    createDirectory,
    createBinaries
}



