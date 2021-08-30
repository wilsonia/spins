const path = require('path');

module.exports = {
	entry: './src/gui.js',
	mode: 'development',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'bundle.js',
	},
};
