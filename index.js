var express = require('express');
var http = require('http');
const fs = require("fs");
var app = express();

require('events').EventEmitter.defaultMaxListeners = 200;

const cors = require('cors');
app.use(cors({credentials: true, origin: true}));

const { Client } = require('@elastic/elasticsearch');

var client = new Client({
    node: 'https://209.151.152.71:9200',
    auth: {
        username: 'elastic',
        password: "1idqXQYv97NwAFwO+08T"
    },
    tls: {
        ca: fs.readFileSync('/root/index/http_ca.crt'),
        rejectUnauthorized: false
    }
});

var memjs = require("memjs");
var memcached = memjs.Client.create("127.0.0.1:11211");

app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.get('/index/search', async (req, res) => {
    let query = req.query.q
    let data = await memcached.get(query)
    if (data.value){
        return res.send(JSON.parse(data.value))
    }else{
        try {
            client.search({
                index: 'yjs',
                size: 10,
                _source: false,
                query: {
                    match: {
                        content: {
                            query: query,
                        }
                    }
                },
                highlight: {
                    order: "score",
                    fragment_size: 30,
                    number_of_fragments: 3,
                    fields: {
                        content: {    }
                    }
                }
            }).then(result => {
                let hits = result.hits.hits
                let response = []
                for (let i=0; i<hits.length; i++){
                    response.push({
                        docid: hits[i]["_id"],
                        name: "Milestone #4",
                        snippet: hits[i]["highlight"]["content"].join(' ')
                    })
                }
                
                res.status(200).json(response)
                memcached.set(query, JSON.stringify(response), {expires:10}, function (err) {  });
            })
            
        } catch (error) {
            console.log(error)
        }
    }
})

app.get('/index/suggest', async (req, res) => {
    let query = req.query.q
    let data = await memcached.get(query)
    if (data.value){
        return res.send(JSON.parse(data.value))
    }else{
        try {
            client.search({
                index: "yjs-suggest",
                _source: false,
                suggest: {
                    autocomplete: {
                        prefix: query,
                        completion: {
                            field: "suggest",
                            skip_duplicates: true
                        }
                    }
                }
            }).then(result => {
                let response = []
    
                let options = result.suggest.autocomplete[0].options
        
                for (let i=0; i<options.length; i++){
                    response.push(options[i]["text"])
                }
                res.status(200).json(response)
                memcached.set(query, JSON.stringify(response), {expires:10}, function (err) {  });
            })
        } catch (error) {
            console.log(error)
        }
    }
})


var server = http.createServer(app);

let port = 4000

server.listen(port, function(){
    console.log("server is running on port", port);
})