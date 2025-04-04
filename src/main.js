let output = document.getElementById("output");
var salt = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F]);
const crypt = new OpenCrypto()

async function encode() {
    let textElement = document.getElementById("message");
    let keyElement = document.getElementById("key");
    let imageElement = document.getElementById("image");
    let msb = document.getElementById("msb").checked;
    
    if (textElement.value === "") {
        outputError("Please enter text to encode.");
        return;
    }

    if (keyElement.value === "") {
        outputError("Please enter a key.");
        return;
    }

    if (imageElement.files.length === 0) {
        outputError("Please select an image.");
        return;
    }

    let passphraseKey = await crypt.derivePassphraseKey(keyElement.value, salt);
    let textEncoder = new TextEncoder();
    let cipher = await crypt.encrypt(passphraseKey, textEncoder.encode(textElement.value));
    let cipherByteArray = textEncoder.encode(cipher);
    let cipherBytesLength = cipherByteArray.length;
    let cipherBytes = new Uint8Array(4);
    cipherBytes[0] = (cipherBytesLength >> 24) & 0xFF;
    cipherBytes[1] = (cipherBytesLength >> 16) & 0xFF;
    cipherBytes[2] = (cipherBytesLength >> 8) & 0xFF;
    cipherBytes[3] = cipherBytesLength & 0xFF;
    let encodedMessage = new Uint8Array(cipherBytesLength + cipherBytes.length);
    encodedMessage.set(cipherBytes, 0);
    encodedMessage.set(cipherByteArray, cipherBytes.length);

    let requiredBytes = encodedMessage.length * 4;
    
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

        for (let i = 0; i < encodedMessage.length; i++) {
            let byte = encodedMessage[i];
            for (let j = 0; j < 4; j++) {
                if (msb) {
                    rawPixelData[i * 4 + j] &= 0x3F;
                    rawPixelData[i * 4 + j] |= ((byte >> (j * 2)) & 0x03) << 6;
                }
                else {
                    rawPixelData[i * 4 + j] &= 0xFC;
                    rawPixelData[i * 4 + j] |= (byte >> (j * 2)) & 0x03;
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
    let keyElement = document.getElementById("key");
    let imageElement = document.getElementById("image");
    let msb = document.getElementById("msb").checked;

    if (keyElement.value === "") {
        outputError("Please enter a key.");
        return;
    }

    if (imageElement.files.length === 0) {
        outputError("Please select an image.");
        return;
    }

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
        let cipherByteArray = new Uint8Array(rawPixelData.byteLength / 4);
        for (let i = 0; i < cipherByteArray.length; i++) {
            let byte = 0;
            for (let j = 0; j < 4; j++) {
                if (msb) {
                    byte |= ((rawPixelData[i * 4 + j] & 0xC0) >> 6) << (j * 2);
                }
                else {
                    byte |= (rawPixelData[i * 4 + j] & 0x03) << (j * 2);
                }
                
            }
            cipherByteArray[i] = byte;
        }
        let cipherBytesLength = 0;
        cipherBytesLength |= (cipherByteArray[0] & 0xFF) << 24;
        cipherBytesLength |= (cipherByteArray[1] & 0xFF) << 16;
        cipherBytesLength |= (cipherByteArray[2] & 0xFF) << 8;
        cipherBytesLength |= (cipherByteArray[3] & 0xFF);

        try 
        {
            let passphraseKey = await crypt.derivePassphraseKey(keyElement.value, salt);
            let textDecoder = new TextDecoder();
            let decrypted = await crypt.decrypt(passphraseKey, textDecoder.decode(cipherByteArray.slice(4, 4 + cipherBytesLength)));
            outputSuccess("Decoded message: <br/>" + textDecoder.decode(decrypted));
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