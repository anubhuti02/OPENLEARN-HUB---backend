import dns from 'dns';

const hostname = 'cluster0.seuoq1i.mongodb.net';

dns.resolveSrv(`_mongodb._tcp.${hostname}`, (err, addresses) => {
  if (err) {
    console.error('DNS SRV Resolve Failed:', err.message);
  } else {
    console.log('SRV Records:', addresses);
  }
});

dns.resolve4(hostname, (err, addresses) => {
  if (err) {
    console.error('DNS A Resolve Failed:', err.message);
  } else {
    console.log('A Records:', addresses);
  }
});
