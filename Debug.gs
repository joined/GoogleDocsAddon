/**
 * Test the EntityExtractor class
 */
function testEntityExtractor() {
    var string = 'Jan 12 06:26:19: ACCEPT service http from 119.63.193.196 to firewall(pub-nic), prefix: "none" (in: eth0 119.63.193.196(5c:0a:5b:63:4a:82):4399 -> 140.105.63.164(50:06:04:92:53:44):80 TCP flags: ****S* len:60 ttl:32)\nJan 12 06:26:20: ACCEPT service dns from 140.105.48.16 to firewall(pub-nic-dns), prefix: "none" (in: eth0 140.105.48.16(00:21:dd:bc:95:44):4263 -> 140.105.63.158(00:14:31:83:c6:8d):53 UDP len:76 ttl:62)\nJan 12 06:27:09: DROP service 68->67(udp) from 216.34.211.83 to 216.34.253.94, prefix: "spoof iana-0/8" (in: eth0 213.92.153.78(00:1f:d6:19:0a:80):68 -> 69.43.177.110(00:30:fe:fd:d6:51):67 UDP len:576 ttl:64)\nJan 12 06:27:13: DROP service 68->67(udp) from 213.92.39.37 to 216.34.41.186, prefix: "spoof iana-0/8" (in: eth0 216.34.190.233(00:80:5a:49:61:ab):68 -> 69.43.93.45(00:26:32:9d:8d:35):67 UDP len:576 ttl:64)';

    // Desired extractions list
    var desiredExtractions = [
        new TextRange(42, 55, '119.63.193.196'),
    ];

    // Desired unextractions list
    var desiredUnextractions = [
        new TextRange(0, 41, 'Jan 12 06:26:19: ACCEPT service http from '),
    ];

    var ee = new EntityExtractor(string, desiredExtractions, desiredUnextractions);
    ee.run();
    Logger.log('Classified tokens list:\n' + JSON.stringify(ee.getSystemExtractions(), null, 4));
    Logger.log('Query:\n' + JSON.stringify(ee.getQuery(), null, 4));
}
