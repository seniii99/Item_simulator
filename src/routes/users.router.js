import express from "express";
import { prisma } from "../utils/prisma/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddlewares from "../middlewares/auth.middlewares.js";

const router = express.Router();

const isValidId = (id) => /^[a-z0-9]+$/.test(id); // 영어 소문자와 숫자 조합
const isValidPassword = (password) => password.length >= 6; // 최소 6자 이상

/** 사용자 회원가입 API **/
router.post("/sign-up", async (req, res, next) => {
  const { id, password, passwordCheck, name } = req.body;

  // 아이디 유효성 검사
  if (!isValidId(id)) {
    return res.status(400).json({
      message: "아이디는 영어 소문자와 숫자의 조합으로만 구성되어야 합니다.",
    });
  }

  // 비밀번호 유효성 검사
  if (!isValidPassword(password)) {
    return res.status(400).json({
      message: "비밀번호는 최소 6자 이상이어야 합니다.",
    });
  }

  if (password !== passwordCheck) {
    return res.status(400).json({ message: "비밀번호가 일치하지 않습니다." });
  }

  try {
    const isExistUser = await prisma.users.findFirst({
      where: { id },
    });

    if (isExistUser) {
      return res.status(409).json({ message: "이미 존재하는 아이디입니다." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 트랜잭션으로 Users와 UserInfos에 데이터 생성
    const user = await prisma.$transaction(async (prisma) => {
      const newUser = await prisma.users.create({
        data: { id, password: hashedPassword, passwordCheck, name },
      });
      await prisma.userInfos.create({
        data: {
          userId: newUser.userId,
          id: newUser.id,
          name: newUser.name,
        },
      });
      return newUser;
    });

    return res.status(201).json({ message: "회원가입이 완료되었습니다." });
  } catch (error) {
    next(error); // 에러를 글로벌 에러 핸들러로 전달
  }
});

/** 로그인 API **/
router.post("/sign-in", async (req, res, next) => {
  const { id, password } = req.body;

  try {
    const user = await prisma.users.findFirst({ where: { id } });

    if (!user) {
      return res.status(401).json({ message: "존재하지 않는 아이디입니다." });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "비밀번호가 일치하지 않습니다." });
    }

    const token = jwt.sign(
      { userId: user.userId },
      process.env.JWT_SECRET, // 환경 변수로 분리
      { expiresIn: "1h" } // 토큰 만료 시간 설정
    );

    res.cookie("authorization", `Bearer ${token}`, { httpOnly: true }); // 보안 강화
    return res.status(200).json({ message: "로그인 성공" });
  } catch (error) {
    next(error);
  }
});

export default router;
