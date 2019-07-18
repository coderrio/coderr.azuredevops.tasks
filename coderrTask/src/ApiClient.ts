import Axios, * as http from "axios";
import { AxiosRequestConfig, AxiosPromise, Method } from "axios";
import * as crypto from "crypto";
import { METHODS } from "http";

export interface IHttpResponse {
  statusCode: number;
  statusReason: string;
  contentType: string | null;
  body: any;
  charset: string | null;
}

export class HttpError extends Error {
  message: string;
  reponse: IHttpResponse;

  constructor(response: IHttpResponse) {
    super(response.statusReason);
    this.message = response.statusReason;
    this.reponse = response;
  }
}

export class QueryString {
  static parse(str: string): any {
    str = str.trim().replace(/^(\?|#)/, "");
    if (!str) {
      return null;
    }

    const data = str
      .trim()
      .split("&")
      .reduce((ret: any, param) => {
        var parts = param.replace(/\+/g, " ").split("=");
        var key = parts[0];
        var val: string | null = parts[1];

        key = decodeURIComponent(key);
        val = val === undefined ? null : decodeURIComponent(val);
        if (!ret.hasOwnProperty(key)) {
          ret[key] = val;
        } else if (Array.isArray(ret[key])) {
          ret[key].push(val);
        } else {
          ret[key] = [ret[key], val];
        }

        return ret;
      }, {});

    return data;
  }

  static stringify(data: any): string {
    return data
      ? Object.keys(data)
          .map(key => {
            var val = data[key];

            if (Array.isArray(val)) {
              return val
                .map(
                  val2 =>
                    encodeURIComponent(key) + "=" + encodeURIComponent(val2)
                )
                .join("&");
            }

            return encodeURIComponent(key) + "=" + encodeURIComponent(val);
          })
          .join("&")
      : "";
  }
}

export class CoderrApiClient {
  constructor(
    private url: string,
    private apiKey: string,
    private sharedSecret: string
  ) {
    if (this.url[url.length - 1] !== "/") {
      this.url += "/";
    }
    this.url += "api/cqs/";
  }

  async command(message: any) {
    await this.request("POST", message, null);
  }

  async query(query: any): Promise<any> {
    return await this.request("GET", null, query);
  }

  private createSignature(sharedSecret: string, payload: Buffer): string {
    return crypto
      .createHmac("sha256", payload)
      .update("simple")
      .digest()
      .toString("base64");
  }

  private async request(method: Method, message: any, queryParameters: any): any {
    var json = JSON.stringify(message);
    var payload = Buffer.from(json, "utf8");
    var signature = this.createSignature(this.sharedSecret, payload);

    var config: AxiosRequestConfig = {
      url: this.url,
      method: method,
      data: payload,
      headers: {
        Accept: "application/json",
        Authorization: `ApiKey ${this.apiKey} ${signature}`,
        "X-Api-Signature": signature,
        "X-Api-Key": this.apiKey,
        "X-Cqs-Name": message.constructor.TYPE_NAME
      }
    };
    if (queryParameters != null) {
      config.url += "?" + QueryString.stringify(queryParameters);
    }

    var result = await http.default.request(config);

    // no data
    if (result.status == 204) {
      return null;
    }

    if (result.status >= 400) {
      throw new HttpError({
        body: result.data,
        charset: result.headers.charset,
        contentType: result.request.contentType,
        statusCode: result.status,
        statusReason: result.statusText
      });
    }

    return result.data;
  }
}
