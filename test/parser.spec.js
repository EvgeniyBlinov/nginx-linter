let assert = require('assert');
let parser = require('../lib/parser');
let fs = require('fs');

function punctuation(text) {
    return { type: 'punctuation', text };
}

function parameter(text) {
    return { type: 'parameter', text };
}

function directive(name, parameters, body) {
    if (body == null) {
        body = [punctuation(';')];
    } else {
        body.unshift(punctuation('{'));
        body.push(punctuation('}'));
    }
    parameters = parameters || [];
    parameters = parameters.map(parameter);
    return {
        type: 'directive',
        name,
        parameters,
        body,
    };
}

function luaBlock(body) {
    return {
        type: 'lua:block',
        body,
    };
}

function lua(text) {
    return {
        type: 'lua:code',
        text,
    };
}

function sanitizeParseTree(node) {
    if (Array.isArray(node)) {
        return node.filter(subNode => ['whitespace', 'newline', 'comment', 'lua:comment'].indexOf(subNode.type) === -1).map(sanitizeParseTree);
    } else {
        let sanitizeNode = Object.assign({}, node);
        delete sanitizeNode['pos'];
        if (sanitizeNode.type === 'directive') {
            sanitizeNode.parameters = sanitizeParseTree(sanitizeNode.parameters);
            sanitizeNode.body = sanitizeParseTree(sanitizeNode.body);
        } else if (sanitizeNode.type === 'lua:block') {
            sanitizeNode.body = sanitizeParseTree(sanitizeNode.body);
        }
        return sanitizeNode;
    }
}

const TEST_CONFIGS = {
    'simple.conf': [
        directive('events', null, []),
        directive('http', null, [
            directive('server', null, [
                directive('listen', ['80']),
                directive('location', ['=', '/ok'], [
                    directive('return', ['200']),
                ]),
            ]),
        ]),
    ],
    'single-quotes.conf': [
        directive('events', null, []),
        directive('http', null, [
            directive('server', null, [
                directive('listen', ['80']),
                directive('location', ['=', '\'/o\\\'k\''], [
                    directive('return', ['200']),
                ]),
            ]),
        ]),
    ],
    'if-is-evil.conf': [
        directive('events', null, []),
        directive('http', null, [
            directive('server', null, [
                directive('listen', ['80']),
                directive('location', ['=', '/ok'], [
                    directive('if', ['($request_method', '=', 'POST)'], [
                        directive('return', ['405']),
                    ]),
                    directive('return', ['200']),
                ]),
                directive('location', ['=', '/ok-but-bad'], [
                    directive('if', ['($request_method', '=', 'POST)'], [
                        directive('return', ['405']),
                    ]),
                    directive('return', ['200']),
                ]),
                directive('location', ['=', '/rewrite-from'], [
                    directive('if', ['($request_method', '=', 'POST)'], [
                        directive('rewrite', ['^', '/rewrite-to', 'last']),
                    ]),
                    directive('return', ['200']),
                ]),
                directive('location', ['=', '/rewrite-to'], [
                    directive('return', ['200']),
                ]),
                directive('location', ['=', '/rewrite-bad-but-ok'], [
                    directive('if', ['($request_method', '=', 'POST)'], [
                        directive('rewrite', ['^', '/rewrite-to', 'break']),
                    ]),
                    directive('return', ['200']),
                ]),
                directive('location', ['=', '/rewrite-bad'], [
                    directive('if', ['($request_method', '=', 'POST)'], [
                        directive('rewrite', ['^', '/rewrite-to', 'break']),
                    ]),
                    directive('return', ['200']),
                ]),
                directive('location', ['/crash'], [
                    directive('set', ['$true', '1']),
                    directive('if', ['($true)'], [
                        directive('proxy_pass', ['http://127.0.0.1:8080/']),
                    ]),
                    directive('if', ['($true)'], []),
                ]),
            ]),
        ]),
    ],
    'lua.conf': [
        directive('events', null, []),
        directive('http', null, [
            directive('server', null, [
                directive('listen', ['80']),
                directive('location', ['=', '/ok'], [
                    directive('content_by_lua_block', null, [
                        luaBlock([
                            lua('local'),
                            lua('_M'),
                            lua('='),
                            punctuation('{'),
                            punctuation('}'),
                            lua('function'),
                            lua('_M.go()'),
                            lua('if'),
                            lua('ngx.req.get_body_data()'),
                            lua('then'),
                            lua('ngx.say('),
                            lua('"Got data"'),
                            lua(')'),
                            lua('else'),
                            lua('ngx.say('),
                            lua('"No data"'),
                            lua(')'),
                            lua('end'),
                            lua('end'),
                            lua('_M.go()'),
                        ]),
                    ]),
                ]),
            ]),
        ]),
    ],
};

describe('parser', () => {
    describe('#parse()', () => {
        for (let configFileName in TEST_CONFIGS) {
            let expectedParseTree = TEST_CONFIGS[configFileName];
            it(`should handle ${configFileName} file`, () => {
                let actualParseTree = parser.parse(fs.readFileSync(__dirname + '/examples/' + configFileName, 'utf8'));
                assert.deepStrictEqual(sanitizeParseTree(actualParseTree), expectedParseTree);
            });
        }
    });
});
