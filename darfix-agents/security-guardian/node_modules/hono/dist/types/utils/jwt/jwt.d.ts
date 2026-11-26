import { AsymmetricAlgorithm, SignatureAlgorithm } from "./jwa.js";
import { HonoJsonWebKey, SignatureKey } from "./jws.js";
import { JWTPayload } from "./types.js";
//#region src/utils/jwt/jwt.d.ts
export interface TokenHeader {
  alg: SignatureAlgorithm;
  typ?: string;
  kid?: string;
}
export declare function isTokenHeader(obj: unknown, typ?: string | string[]): obj is TokenHeader;
export declare const sign: (payload: JWTPayload, privateKey: SignatureKey, alg?: SignatureAlgorithm) => Promise<string>;
export type VerifyOptions = {
  /** The expected issuer used for verifying the token */
  iss?: string | RegExp;
  /** Verify the `nbf` claim (default: `true`) */
  nbf?: boolean;
  /** Verify the `exp` claim (default: `true`) */
  exp?: boolean;
  /** Verify the `iat` claim (default: `true`) */
  iat?: boolean;
  /** Acceptable audience(s) for the token */
  aud?: string | string[] | RegExp;
  /** The expected `typ` header, for example `at+jwt` for OAuth 2.0 access tokens. When set, the token must have it (default: `JWT`, or no `typ`) */
  typ?: string | string[];
};
export type VerifyOptionsWithAlg = {
  /** The algorithm used for decoding the token */
  alg: SignatureAlgorithm;
} & VerifyOptions;
export declare const verify: (token: string, publicKey: SignatureKey, algOrOptions: SignatureAlgorithm | VerifyOptionsWithAlg) => Promise<JWTPayload>;
export declare const verifyWithJwks: (token: string, options: {
  keys?: HonoJsonWebKey[];
  jwks_uri?: string;
  verification?: VerifyOptions;
  allowedAlgorithms: readonly AsymmetricAlgorithm[];
}, init?: RequestInit) => Promise<JWTPayload>;
export declare const decode: (token: string) => {
  header: TokenHeader;
  payload: JWTPayload;
};
export declare const decodeHeader: (token: string) => TokenHeader;
//#endregion