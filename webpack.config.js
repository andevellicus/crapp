const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack'); // add this

module.exports = {
  mode: 'development',
  entry: './static/js/src/index.jsx',
  output: {
    path: path.resolve(__dirname, 'static/dist'),
    filename: 'js/main.js',
    publicPath: '/static/dist/'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              ['@babel/preset-react', { "runtime": "automatic" }]
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name].css'
    }),
    // This plugin injects React automatically
    new webpack.ProvidePlugin({
      React: 'react'
    })
  ],
  devtool: 'source-map'
};
