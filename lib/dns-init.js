import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (err) {
  console.warn('Failed to force custom DNS servers in dns-init:', err);
}
