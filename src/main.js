let output = document.getElementById("output");

async function encode() {
    let textElement = document.getElementById("message");
    let seedElement = document.getElementById("seed");
    let imageElement = document.getElementById("image");
    let msb = document.getElementById("msb").checked;
    
    if (textElement.value === "") {
        outputError("Please enter text to encode.");
        return;
    }

    if (seedElement.value === "") {
        outputError("Please enter a seed.");
        return;
    }

    if (imageElement.files.length === 0) {
        outputError("Please select an image.");
        return;
    }

    let seed = Number(seedElement.value);
    let textEncoder = new TextEncoder();
    let byteArray = textEncoder.encode(textElement.value)
    let bytesLength = byteArray.length;
    let lengthInBytes = new Uint8Array(4);
    lengthInBytes[0] = (bytesLength >> 24) & 0xFF;
    lengthInBytes[1] = (bytesLength >> 16) & 0xFF;
    lengthInBytes[2] = (bytesLength >> 8) & 0xFF;
    lengthInBytes[3] = bytesLength & 0xFF;


    let requiredBytes = byteArray.length * 4;
    
    let file = imageElement.files[0];
    let reader = new FileReader();
    reader.onload = async function (event) {
        let imageData = event.target.result;
        let imageArrayBuffer = new Uint8Array(imageData);
    
        const BMP_HEADER_SIZE = 124;
        if (imageArrayBuffer.byteLength <= BMP_HEADER_SIZE) {
            outputError("Invalid BMP file or file too small.");
            return;
        }
    
        let rawPixelData = imageArrayBuffer.slice(BMP_HEADER_SIZE);
        if (rawPixelData.byteLength < requiredBytes) {
            outputError("Image is too small to encode the message.");
            return;
        }

        let dataRandomIndexes = getRandomIndexes(seed, byteArray.length * 4, rawPixelData.byteLength);
        
        for (let i = 0; i < lengthInBytes.length; i++) {
            let byte = lengthInBytes[i];
            for (let j = 0; j < 4; j++) {
                let index = i * 4 + j; 
                if (msb) {
                    rawPixelData[index] &= 0x3F;
                    rawPixelData[index] |= ((byte >> (j * 2)) & 0x03) << 6;
                }
                else {
                    rawPixelData[index] &= 0xFC;
                    rawPixelData[index] |= (byte >> (j * 2)) & 0x03;
                }
            }
        }

        for (let i = 0; i < byteArray.length; i++) {
            let byte = byteArray[i];
            for (let j = 0; j < 4; j++) {
                let randomIndex = dataRandomIndexes[i * 4 + j]; 
                if (msb) {
                    rawPixelData[randomIndex] &= 0x3F;
                    rawPixelData[randomIndex] |= ((byte >> (j * 2)) & 0x03) << 6;
                }
                else {
                    rawPixelData[randomIndex] &= 0xFC;
                    rawPixelData[randomIndex] |= (byte >> (j * 2)) & 0x03;
                }
            }
        }
    
        let modifiedImageArrayBuffer = new Uint8Array(imageArrayBuffer.byteLength);
        modifiedImageArrayBuffer.set(imageArrayBuffer.slice(0, BMP_HEADER_SIZE));
        modifiedImageArrayBuffer.set(rawPixelData, BMP_HEADER_SIZE);
    
        let blob = new Blob([modifiedImageArrayBuffer], { type: "image/bmp" });
        let url = URL.createObjectURL(blob);
        outputSuccess("Message encoded successfully! <a href = " + url + ">Download the image.</a>");
    };
    reader.readAsArrayBuffer(file);
}

async function decode() {
    let seedElement = document.getElementById("seed");
    let imageElement = document.getElementById("image");
    let msb = document.getElementById("msb").checked;

    if (seedElement.value === "") {
        outputError("Please enter a key.");
        return;
    }

    if (imageElement.files.length === 0) {
        outputError("Please select an image.");
        return;
    }

    let seed = Number(seedElement.value);
    let file = imageElement.files[0];
    let reader = new FileReader();
    reader.onload = async function (event) {
        let imageData = event.target.result;
        let imageArrayBuffer = new Uint8Array(imageData);
    
        const BMP_HEADER_SIZE = 124;
        if (imageArrayBuffer.byteLength <= BMP_HEADER_SIZE) {
            outputError("Invalid BMP file or file too small.");
            return;
        }
        
        let rawPixelData = imageArrayBuffer.slice(BMP_HEADER_SIZE);
        let lengthByteArray = new Uint8Array(4);
        for (let i = 0; i < lengthByteArray.length; i++) {
            let byte = 0;
            for (let j = 0; j < 4; j++) {
                if (msb) {
                    byte |= ((rawPixelData[i * 4 + j] & 0xC0) >> 6) << (j * 2);
                }
                else {
                    byte |= (rawPixelData[i * 4 + j] & 0x03) << (j * 2);
                }
                
            }
            lengthByteArray[i] = byte;
        }
        let dataLength = 0;
        dataLength |= (lengthByteArray[0] & 0xFF) << 24;
        dataLength |= (lengthByteArray[1] & 0xFF) << 16;
        dataLength |= (lengthByteArray[2] & 0xFF) << 8;
        dataLength |= (lengthByteArray[3] & 0xFF);
        let dataRandomIndexes = getRandomIndexes(seed, dataLength * 4, rawPixelData.byteLength);
        let decodedByteArray = new Uint8Array(dataLength * 4);
        for (let i = 0; i < decodedByteArray.length; i++) {
            let byte = 0;
            for (let j = 0; j < 4; j++) {
                let randomIndex = dataRandomIndexes[i * 4 + j]; 
                if (msb) {
                    byte |= ((rawPixelData[randomIndex] & 0xC0) >> 6) << (j * 2);
                }
                else {
                    byte |= (rawPixelData[randomIndex] & 0x03) << (j * 2);
                }
            }
            decodedByteArray[i] = byte;
        }

        try 
        {
            let textDecoder = new TextDecoder();
            console.log(decodedByteArray);
            let decoded = textDecoder.decode(decodedByteArray);
            outputSuccess("Decoded message: <br/>" + decoded);
        }
        catch (e) 
        {
            outputError("Invalid key");
        }
    };
    reader.readAsArrayBuffer(file);
}

function outputSuccess(msg) {
    output.innerHTML = `<p style="color: green">${msg}</p>`;
}

function outputError(msg) {
    output.innerHTML = `<p style="color: red">${msg}</p>`;
}

function getRandomIndexes(seed, dataLength, imageLength) {
    let dataRandomIndexes = [];
    let usedIndexes = new Set();
    let rand = makeRand(seed);

    while (dataRandomIndexes.length < dataLength) {
        let randomIndex = Math.floor(rand.next().value * imageLength);
        if (randomIndex > 16 && randomIndex < imageLength && !usedIndexes.has(randomIndex)) {
            dataRandomIndexes.push(randomIndex);
            usedIndexes.add(randomIndex);
        }
    }

    return dataRandomIndexes;
}

function *makeRand(seed) {
    while (true) {
      seed = seed * 16807 % 2147483647
      yield seed / 2147483647
    }
  }
