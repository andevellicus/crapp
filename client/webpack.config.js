const path = require('path');
const webpack = require('webpack'); 
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './src/index.jsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'main.js',
      publicPath: '/'
    },
    // Enable source maps for debugging
    devtool: isProduction ? 'source-map' : 'inline-source-map',
    resolve: {
      extensions: ['.js', '.jsx']
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react'],
              sourceMaps: true
            }
          }
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                sourceMap: true
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/templates/app.html'
      }),
      new MiniCssExtractPlugin({
        filename: 'css/[name].css'
      }),
      new webpack.ProvidePlugin({
        React: 'react'
      }),
      new CopyWebpackPlugin({
        patterns: [
          { 
            from: 'public', 
            to: '', 
            globOptions: {
              ignore: ['**/index.html']
            }
          }
        ]
      })
    ],
  };
};