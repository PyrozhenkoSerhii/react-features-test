import { Configuration } from "webpack";
import * as TerserPlugin from "terser-webpack-plugin";
import * as MiniCssExtractPlugin from "mini-css-extract-plugin";
import * as OptimizeCssAssetsPlugin from "optimize-css-assets-webpack-plugin";
import merge from "webpack-merge";

import baseConfig from "./webpack.config.base";

const prodConfiguration: Configuration = {
  mode: "production",
  output: {
    publicPath: "/",
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        cache: true,
        parallel: true,
      }),
      new OptimizeCssAssetsPlugin(),
    ],
  },
  module: {
    rules: [
      {
        test: /\.less$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              sourceMap: true,
            },
          },
          {
            loader: "less-loader",
            options: {
              sourceMap: true,
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
    }),
  ],
};

const config: Configuration = merge(baseConfig, prodConfiguration);

export default config;
