const http = require('http');
const dgram = require('dgram');
const os = require('os');

const HTTP_PORT = 4242;
const UDP_PORT = 4243;
const DISCOVER_MSG = 'DUT_DISCOVER';
const DISCOVER_REPLY = 'DUT_HERE';

let _db = null;

function getLocalIPs() {
  const result = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) result.push(addr.address);
    }
  }
  return result;
}

function getBroadcastAddresses() {
  const result = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const ip = addr.address.split('.').map(Number);
        const mask = addr.netmask.split('.').map(Number);
        result.push(ip.map((b, i) => b | (~mask[i] & 0xff)).join('.'));
      }
    }
  }
  return result;
}

function startHttpServer(dbInstance) {
  _db = dbInstance;
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET' && req.url === '/ping') {
      res.end(JSON.stringify({ ok: true }));

    } else if (req.method === 'GET' && req.url === '/data') {
      res.end(JSON.stringify(_db.getAllForSync()));

    } else if (req.method === 'POST' && req.url === '/merge') {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        try {
          _db.mergeFromPeer(JSON.parse(body));
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: e.message }));
        }
      });

    } else {
      res.statusCode = 404;
      res.end('{}');
    }
  });

  server.on('error', () => {}); // port already in use — ignore silently
  server.listen(HTTP_PORT, '0.0.0.0');
}

function startDiscoveryListener() {
  const localIPs = getLocalIPs();
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('message', (msg, rinfo) => {
    if (msg.toString() === DISCOVER_MSG && !localIPs.includes(rinfo.address)) {
      const reply = Buffer.from(DISCOVER_REPLY);
      socket.send(reply, 0, reply.length, rinfo.port, rinfo.address);
    }
  });

  socket.on('error', () => {}); // ignore bind errors
  socket.bind(UDP_PORT, '0.0.0.0');
}

function discoverPeers(timeoutMs = 2000) {
  return new Promise(resolve => {
    const peers = [];
    const localIPs = getLocalIPs();
    const sock = dgram.createSocket('udp4');

    sock.on('message', (msg, rinfo) => {
      if (
        msg.toString() === DISCOVER_REPLY &&
        !localIPs.includes(rinfo.address) &&
        !peers.includes(rinfo.address)
      ) {
        peers.push(rinfo.address);
      }
    });

    sock.on('error', () => { try { sock.close(); } catch (_) {} resolve(peers); });

    sock.bind(() => {
      sock.setBroadcast(true);
      const msg = Buffer.from(DISCOVER_MSG);
      for (const bcast of getBroadcastAddresses()) {
        sock.send(msg, 0, msg.length, UDP_PORT, bcast);
      }
      setTimeout(() => {
        try { sock.close(); } catch (_) {}
        resolve(peers);
      }, timeoutMs);
    });
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      res => {
        let resp = '';
        res.on('data', c => (resp += c));
        res.on('end', () => {
          try { resolve(JSON.parse(resp)); } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function syncWithPeer(peerIP) {
  const peerData = await httpGet(`http://${peerIP}:${HTTP_PORT}/data`);
  const changed = _db.mergeFromPeer(peerData);
  const localData = _db.getAllForSync();
  await httpPost(`http://${peerIP}:${HTTP_PORT}/merge`, localData);
  return changed;
}

module.exports = { startHttpServer, startDiscoveryListener, discoverPeers, syncWithPeer };
