import { Configuration as WebpackConfiguration, ProgressPlugin } from "webpack";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import * as HtmlWebpackPlugin from "html-webpack-plugin";

const config: WebpackConfiguration = {
  target: "web",
  node: {
    fs: "empty",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
  },
  entry: "./src/index.tsx",
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        loader: "ts-loader",
      },
      {
        test: /\.(eot|ttf|woff2?|otf|png|jpe?g|gif|mp3)$/,
        use: [
          "file-loader",
        ],
      },
      {
        test: /\.svg$/,
        loader: "@svgr/webpack",
      },
    ],
  },
  plugins: [
    new ProgressPlugin(),
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: "./src/index.html",
    }),
  ],
};

export default config;
