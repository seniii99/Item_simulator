// src/middlewares/auth.middleware.js

import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma/index.js";

export default async function (req, res, next) {
  try {
    const { authorization } = req.cookies;

    if (!authorization) throw new Error("토큰이 존재하지 않습니다.");

    const [tokenType, token] = authorization.split(" ");

    if (tokenType !== "Bearer")
      throw new Error("토큰 타입이 일치하지 않습니다.");

    // JWT 비밀키로 토큰 검증
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = parseInt(decodedToken.userId, 10); // 명시적 변환

    // 사용자 확인
    const user = await prisma.users.findFirst({
      where: { userId },
    });
    if (!user) {
      res.clearCookie("authorization");
      throw new Error("토큰 사용자가 존재하지 않습니다.");
    }

    // req.user에 사용자 정보 저장
    req.user = user;

    next();
  } catch (error) {
    console.error("인증 오류:", error.message);

    res.clearCookie("authorization");

    // 토큰 오류에 따라 다른 메시지와 상태 코드 반환
    switch (error.name) {
      case "TokenExpiredError":
        return res.status(401).json({ message: "토큰이 만료되었습니다." });
      case "JsonWebTokenError":
        return res.status(401).json({ message: "토큰이 유효하지 않습니다." });
      default:
        return res.status(401).json({
          message: error.message ?? "비정상적인 요청입니다.",
        });
    }
  }
}
