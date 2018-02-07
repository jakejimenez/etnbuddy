// Requires
var request = require("request");
const {clipboard} = require('electron');
var os = require('os');
var fs = require('fs');
var extract = require('extract-zip')
const Store = require('electron-store');
const store = new Store();
var http = require('http');

// Important variables
var CMCurl = "https://api.coinmarketcap.com/v1/ticker/electroneum/";
var windowsUrl = "https://github.com/electroneum/electroneum/releases/download/v0.11.1.0/win-x64-0.11.1.0.zip";
var macUrl = "https://github.com/electroneum/electroneum/releases/download/v0.11.1.0/macOS-x64-0.11.1.0.zip";
var pendingRequests = [];
var buddyPathWin = os.homedir() + '\\etnbuddy';
var buddyPathMac = os.homedir() + '/etnbuddy';
var isDownloaded = false;
var isWalletOpen = false;
var canOpenWallet = false;
var isWalletFileOpened = false;

// Functions
function download(url, filename) {
  console.log("Download started...");
  request(url).pipe(fs.createWriteStream(filename)).on('response', function(response) {
    console.log(response.statusCode);
  }).on('error', function(err) {
    console.log(err)
    alert('An error occurred in your download of: ' + filename)
  }).on('close', function() {
    console.log('File has been downloaded and written...');
    if (os.platform() == 'win32') {
      console.log("Extracting...")
      extract(buddyPathWin + '\\core.zip', {
        dir: buddyPathWin
      }, function(err) {
        if (err) {
          alert(err)
          //store.set('isUnzipped', false)
        }
      })
      store.set('isUnzipped', true)
    }
    if (os.platform() == 'darwin') {
      console.log("Extracting...")
      extract(buddyPathMac + '/core.zip', {
        dir: buddyPathMac
      }, function(err) {
        if (err) {
          alert(err)
          //store.set('isUnzipped', false)
        }
      })
      store.set('isUnzipped', true)
    }
  });
}

function checkRequests(requests) {
  console.log(requests);
};

function openWallet() {
  console.log("Opening wallet RPC");
  var walletPath = buddyPathWin + '\\wallets';
  var rpcPath = buddyPathWin + '\\electroneum-wallet-rpc.exe';
  var spawn = require('child_process').execFile;
  var parameters = [
    '--rpc-bind-port=26969', '--disable-rpc-login', '--wallet-dir=' + walletPath + ''
  ];
  console.log("Opening RPC")
  var wallet = spawn(rpcPath, parameters, {});
  wallet.stdout.on('data', function(data) {
    if (data.indexOf('Starting wallet rpc server') != -1) {
      console.log("Done!")

      if (store.get('hasWalletFile') == undefined) {
        console.log('Does not have a wallet file.')
        var body = {
          "jsonrpc": "2.0",
          "id": "0",
          "method": "create_wallet",
          "params": {
            "filename": "etnbuddy",
            "password": "",
            "language": "English"
          }
        };
        var res = jsonRpcRequest(body, "26969").then(function(result) {
          store.set('hasWalletFile', true);
        });
        console.log('Wallet file created.')
        isWalletFileOpened = true;
      } else if (store.get('hasWalletFile') == true) {
        console.log('Wallet file found...')
        var body = {
          "jsonrpc": "2.0",
          "id": "0",
          "method": "open_wallet",
          "params": {
            "filename": "etnbuddy",
            "password": ""
          }
        };
        var res = jsonRpcRequest(body, "26969").then(function(result) {
          console.log(result);
        });
        console.log('Wallet has been opened.')
        isWalletFileOpened = true;
      }

      if (isWalletFileOpened) {
        var body = {
          "jsonrpc": "2.0",
          "id": "0",
          "method": "getbalance"
        };
        var res = self.jsonRpcRequest(body, "26969").then(function(result) {
          unlockSpan.innerHTML = result.unlocked_balance;
          lockedSpan.innerHTML = result.balance;
        });
        var body = {
          "jsonrpc": "2.0",
          "id": "0",
          "method": "getaddress"
        };
        var res = self.jsonRpcRequest(body, "26969").then(function(result) {
          addressSpan.value = result.address;
        });
      }
    }
  });
}

function jsonRpcRequest(body, port) {
  let requestJSON = JSON.stringify(body);

  // set basic headers
  let headers = {};
  headers['Content-Type'] = 'application/json';
  headers['Content-Length'] = Buffer.byteLength(requestJSON, 'utf8');

  // make a request to the wallet
  let options = {
    hostname: '127.0.0.1',
    port: port,
    path: '/json_rpc',
    method: 'POST',
    headers: headers
  };
  let requestPromise = new Promise((resolve, reject) => {
    let data = '';
    let req = http.request(options, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', function() {
        let body = JSON.parse(data);
        if (body && body.result) {
          resolve(body.result);
        } else if (body && body.error) {
          resolve(body.error);
        } else {
          resolve('Wallet response error. Please try again.');
        }
      });
    });
    req.on('error', (e) => resolve(e));
    req.write(requestJSON);
    req.end();
  });

  return requestPromise;
}

// DOM Elements
var priceSpan = document.getElementById('usdprice');
var rankSpan = document.getElementById('rank');
var changeSpan = document.getElementById('change');
var heightSpan = document.getElementById('height');
var targetSpan = document.getElementById('target');
var unlockSpan = document.getElementById('unlocked');
var lockedSpan = document.getElementById('locked');
var addressSpan = document.getElementById('address');
var addressSendSpan = document.getElementById('addressSend');
var amountSpan = document.getElementById('amountSpan');

// Request Info on coinmarketcap
request({
  url: CMCurl,
  json: true
}, function(err, res, body) {
  if (err) {
    console.log(err);
    priceSpan.innerHTML = "Error"
    rankSpan.innerHTML = "Error"
    changeSpan.innerHTML = "Error"
  } else {
    priceSpan.innerHTML = "$" + body[0].price_usd.substr(0, 5)
    rankSpan.innerHTML = body[0].rank;
    changeSpan.innerHTML = body[0].percent_change_1h + "%";
  }
});

// Create folders if not already created.
if (!fs.existsSync(buddyPathWin) && os.platform() == "win32") {
  fs.mkdirSync(buddyPathWin);
  fs.mkdirSync(buddyPathMac + '\\wallets');
  store.set('isDirectory', true);
}
if (!fs.existsSync(buddyPathMac) && os.platform() == 'darwin') {
  fs.mkdirSync(buddyPathMac);
  fs.mkdirSync(buddyPathMac + '/wallets');
  store.set('isDirectory', true);
}

// Download and unzip Electroneum
if (os.platform() == 'darwin' && !fs.existsSync(buddyPathMac + '/core.zip')) {
  download(macUrl, buddyPathMac + '/core.zip');
  store.set('isDownloaded', true);
  if (os.platform() == 'win32' && store.get('isUnzipped') == true) {
    console.log("Starting daemon...")
    var spawn = require('child_process').execFile;
    var daemon = spawn(buddyPathWin + '\\electroneumd.exe');
    daemon.stdout.on('data', function(data) {
      //console.log(data);
      if (data.indexOf('Core rpc server started ok') != -1) {
        console.log("Daemon ready to recieve requests...")
      }
    });
  }
}
if (os.platform() == 'win32' && !fs.existsSync(buddyPathWin + '\\core.zip')) {
  download(windowsUrl, buddyPathWin + '\\core.zip');
  store.set('isDownloaded', true);
  if (os.platform() == 'win32' && store.get('isUnzipped') == true) {
    console.log("Starting daemon...")
    var spawn = require('child_process').execFile;
    var daemon = spawn(buddyPathWin + '\\electroneumd.exe');
    daemon.stdout.on('data', function(data) {
      //console.log(data);
      if (data.indexOf('Core rpc server started ok') != -1) {
        console.log("Daemon ready to recieve requests...")
      }
    });
  }
}

var blockInterval = setInterval(function() {
  var body = {
    id: "0",
    jsonrpc: "2.0",
    method: "get_info"
  };
  var res = jsonRpcRequest(body, "26968").then(function(result) {
    console.log(result)
    if (result.height == undefined && result.target_height == undefined) {
      heightSpan.innerHTML = "0"
      targetSpan.innerHTML = "0"
    } else {
      heightSpan.innerHTML = result.height;
      targetSpan.innerHTML = result.target_height;
    }
    console.log(result.height + "/" + result.target_height)

    if (result.height >= result.target_height && canOpenWallet != true && result.target_height != 0) {
      canOpenWallet = true;
      if (canOpenWallet == true && isWalletOpen != true) {
        openWallet();
        isWalletOpen = true;
      }
      clearInterval(blockInterval);
    } else if (result.status == "OK") {
      canOpenWallet = true;
      if (canOpenWallet == true && isWalletOpen != true) {
        openWallet();
        isWalletOpen = true;
      }
      clearInterval(blockInterval);
    }
  });
}, 5000)

document.getElementById("copy").onclick = function() {
  clipboard.writeText(document.getElementById('address').value);
};
document.getElementById("send").onclick = function() {
  var body = {"jsonrpc":"2.0","id":"0","method":"getbalance"};
  var res = self.jsonRpcRequest(body, "26969").then(function(result) {
    console.log(result)
    if (result.unlocked_balance >= document.getElementById('amount').value && document.getElementById('amount').value != 0) {
      var body = {
        "jsonrpc": "2.0",
        "id": "0",
        "method": "transfer",
        "params": {
          "destinations": [
            {
              "amount": amountSpan.value,
              "address": addressSendSpan.value
            }
          ],
          "mixin": 0,
          "get_tx_key": true
        }
      }
      var res = self.jsonRpcRequest(body, "26969").then(function(result) {
        alert(result);
      });
    } else {
      alert("ETN could not be sent.")
    }
  });
};
//document.getElementById("refresh").onclick = function() {myFunction()};
