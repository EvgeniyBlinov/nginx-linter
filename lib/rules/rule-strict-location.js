const REGEX_CHARS = '|()[]{^?*+\\'.split('');

function checkLocation(mode, locationMatch, errors) {
    switch (mode) {
        case '=':
            // falls through
        case '':
            if (REGEX_CHARS.any(c => locationMatch.indexOf(c) !== -1)) {
                errors.push('Location match is regular expression when regular string expected');
            }
            break;
    }
}

module.exports = {
    name: 'strict-location',
    default: true,
    invoke: function(node, errors, ignored, state) {
        state = state || {};
        if (node.type === 'directive' && node.name === 'location') {
            state.location = true;
        } else if (node.type === 'parameter') {
            if (state.location) {
                if (state.mode) {
                    checkLocation(state.mode, node.text, errors);
                    state = {};
                } else {
                    state.mode = node.text;
                }
            }
        } else if (node.type === 'punctuation' && node.text === '{') {
            if (state.location) {
                checkLocation('', state.mode, errors);
                state = {};
            }
        }
        return state;
    }
};