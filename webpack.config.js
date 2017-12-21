const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    index: __dirname + '/frontend/src/index.tsx',
  },
  output: {
    path: __dirname + '/sumo_web3d/static',
    filename: '[name].bundle.js',
  },
  devtool: '#cheap-module-source-map',
  module: {
    preLoaders: [
      {
        test: /\.js$/,
        loader: 'source-map-loader',
      },
    ],
    loaders: [
      {
        test: /\.tsx?$/,
        loader: 'awesome-typescript-loader',
        options: {
          transpileOnly: true,
        },
      },
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel',
        query: {
          presets: ['react', 'es2015'],
        },
      },
      {
        test: /\.json$/,
        loader: 'json-loader',
      },
    ],
  },
  // Currently we need to add '.ts' to the resolve.extensions array.
  resolve: {
    extensions: ['', '.ts', '.tsx', '.webpack.js', '.web.js', '.js', '.jsx', '.json'],
    root: path.resolve('./node_modules'),
  },
  resolveLoader: {
    root: path.resolve('./node_modules'),
  },
}
