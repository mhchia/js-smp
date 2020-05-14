const express = require('express');
const app = express();
const expressPeerServer = require('peer').ExpressPeerServer;
const server = app.listen(8000);

const peerServer = expressPeerServer(server);

app.use('/myapp', peerServer);
app.use("/static", express.static('./examples/static/'));

app.get('/client', function(req, res){
    res.sendFile("/client.html", {root: __dirname});
});

// app.get('/b', function(req, res){
//     res.sendFile("/index-clientB.html", {root: __dirname});
// });

peerServer.on('connection', (id) => {
    console.log(`A client connected : ${id}`);
})

peerServer.on('disconnect', (id) => {
    console.log(`A client say ~ bye bye : ${id}`);
});
