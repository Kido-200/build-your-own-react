const HtmlWebpackPlugin = require('html-webpack-plugin')
const {resolve}  = require('path')

module.exports = {
  entry:{
    main:'./index.js'
  },
  module:{
    rules:[
      {
        test:/\.js$/,
        use:{
          loader:'babel-loader',
          options:{
            presets:['@babel/preset-env'],
            plugins:[['@babel/plugin-transform-react-jsx',{pragma:'createElement'}]]
          }
        }
      }
    ]
  },

  mode:"development",
  plugins:[
    new HtmlWebpackPlugin({
      template:resolve(__dirname,'index.html')
    })
  ]
}