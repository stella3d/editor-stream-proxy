#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const net = require('net');
const util = require('util');

const ClientPort = 10420;
const EditorProxyPort = 10666;

const EditorPortCount = 10;

var streamIndex = 0;
const testFilePath = '.arclip';


var portOffset = 0;

var editorSocket = null;

for (var i=0; i< EditorPortCount; i++)
    startEditorPort();


function startEditorPort() {
    portOffset++;
    var editorPort = EditorProxyPort + portOffset;

    net.createServer((socket) => {
        console.log(`new editor connection!`);
        startDevicePort(socket, editorPort);
    })
    .listen(editorPort, () => {
        console.log(`listening on editor port ${editorPort}`);
    });
}

const deviceSocketTimeout = 30000;

var recordStreamsToDisk = true;

function startDevicePort(editorSocket, editorPort) {
    var clientPort = editorPort - 246;

    net.createServer((socket) => {
        streamIndex++;
        console.log(`device #${streamIndex} connected!`);
        LogAddressStrings(socket, editorPort);

        if(editorSocket != null) {
            if (recordStreamsToDisk) {
                let path = getClipFilePath();
                connectPipeY(socket, editorSocket, createFileStream(path));
            }
            else {
                connectPipe(socket, editorSocket);
            }

            handleDeviceClose(socket, editorSocket);
            handleDeviceTimeout(socket, editorSocket);
        }
        else
            console.log("no editor connection to route to!");
    })
    .listen(clientPort, () => {
        console.log(`listening on device port ${clientPort}`);
    });
}

function handleDeviceClose(socket, editorSocket)
{
    socket.on('close', (anyErr) => {
        if (anyErr) {
            var at = `for device @ ${socket.remoteAddress}`;
            var on = `on local port ${socket.localPort}`;
            console.log(`socket ${at} ${on} closed due to error!`);

            if (editorSocket != null) {
                var editorAt = `editor port: ${editorSocket.localPort}`;
                console.log(`shutting down the accompanying ${editorAt}`);
                editorSocket.end();
            }
        }
    });
}

function handleDeviceTimeout(socket, editorSocket)
{
    socket.setTimeout(deviceSocketTimeout);
    socket.on('timeout', () => {
        var seconds = deviceSocketTimeout / 1000;
        var reason = `being inactive for ${seconds} seconds`;
        console.log(`socket timed out due to ${reason}!`);
        socket.end();

        setTimeout(() => {
            console.log(`resetting local device port ${socket.localAddress}`)
            if (editorSocket != null)
                startDevicePort(editorSocket, editorSocket.localPort);
        }, 1000);
    });
}

function LogAddressStrings(socket, editorPort)
{
    var s = socket;
    let cleanIP = (ip, port) => `${ip.substring(7)}:${port}`;
    var device = '(device) ' + cleanIP(s.remoteAddress, s.remotePort);
    var proxy = cleanIP(s.localAddress, s.localPort);
    var editor = '(editor) ' + cleanIP(s.localAddress, editorPort);
    console.log(`${device} --> ${proxy} --> ${editor}\n`);
}

function createFileStream(path) {
    console.log('duplicating data to file: ' + path);
    return fs.createWriteStream(path);
}

function getClipFilePath() {
    if (!fs.existsSync("clips"))
        fs.mkdirSync("clips");

    return "clips/" + new Date().getTime() + testFilePath;
}

function createFileReadStream() {
    console.log(`streaming from file ${testFilePath} to network`);
    return fs.createReadStream(testFilePath);
}

function connectPipe(source, destination) {
    source.on('error', console.log);
    destination.on('error', console.log);
    source.pipe(destination);
}

function connectPipeY(source, destination, duplicate) {
    source.on('error', console.log);
    destination.on('error', console.log);
    duplicate.on('error', console.log);
    
    source.on('data', (chunk) => {
        destination.write(chunk);
        duplicate.write(chunk);
    });
}
