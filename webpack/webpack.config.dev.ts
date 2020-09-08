import { Configuration as WebpackConfiguration } from "webpack";
import { Configuration as WebpackDevServerConfiguration } from "webpack-dev-server";
import merge from "webpack-merge";
import * as path from "path";

import baseConfig from "./webpack.config.base";

interface Configuration extends WebpackConfiguration {
  devServer?: WebpackDevServerConfiguration;
}

const devConfiguration: Configuration = {
  output: {
    path: path.resolve(__dirname, "./public"),
    filename: "[name].js",
    publicPath: "/",
  },
  devtool: "source-map",
  devServer: {
    historyApiFallback: true,
    hot: true,
    open: true,
    host: "localhost",
    port: 4000,
  },
  module: {
    rules: [
      {
        test: /\.less$/,
        use: [
          "style-loader",
          "css-loader",
          "less-loader",
        ],
      },
    ],
  },
};

const config: Configuration = merge(baseConfig, devConfiguration);

export default config;
