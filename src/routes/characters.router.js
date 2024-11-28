import express from "express";
import { prisma } from "../utils/prisma/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddlewares from "../middlewares/auth.middlewares.js";

const router = express.Router();

/** 캐릭터 생성 API **/
router.post("/create", authMiddlewares, async (req, res, next) => {
  const { charactername } = req.body;
  const { userId } = req.user;

  try {
    if (!charactername) {
      return res.status(400).json({ message: "캐릭터명을 입력해야 합니다." });
    }

    // 닉네임 중복 확인
    const findCharacter = await prisma.characters.findFirst({
      where: { charactername },
    });

    if (findCharacter) {
      return res.status(400).json({ message: "이미 사용중인 닉네임입니다." });
    }

    // 캐릭터 생성
    const character = await prisma.characters.create({
      data: {
        userId,
        charactername,
        health: 500,
        power: 100,
        money: 10000,
      },
    });

    return res
      .status(201)
      .json({ message: "캐릭터 생성이 완료되었습니다.", character });
  } catch (error) {
    console.error("캐릭터 생성 오류:", error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

/** 캐릭터 상세 조회 API **/
router.get(
  "/character/:charactername",
  authMiddlewares,
  async (req, res, next) => {
    const { charactername } = req.params; // RESTful 설계에 따라 경로 파라미터로 전달
    const { userId } = req.user;

    try {
      const character = await prisma.characters.findFirst({
        where: { charactername },
      });

      if (!character) {
        return res.status(404).json({ message: "캐릭터를 찾을 수 없습니다." });
      }

      // 자신의 캐릭터인지 확인
      const isOwnCharacter = character.userId === userId;

      // 응답할 데이터 객체 생성
      const responseData = {
        charactername: character.charactername,
        level: character.level,
        health: character.health,
        power: character.power,
        ...(isOwnCharacter && { money: character.money }), // 자신의 캐릭터일 때만 money 포함
      };

      return res.status(200).json(responseData);
    } catch (error) {
      console.error("캐릭터 조회 오류:", error);
      return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
  }
);

/** 캐릭터 삭제 API **/
router.delete("/character", authMiddlewares, async (req, res, next) => {
  const { charactername } = req.body;
  const { userId } = req.user;

  try {
    // 캐릭터 존재 및 소유권 확인
    const character = await prisma.characters.findFirst({
      where: {
        charactername,
        userId,
      },
    });

    // 캐릭터가 없거나 현재 사용자의 캐릭터가 아닌 경우
    if (!character) {
      return res
        .status(404)
        .json({ message: "캐릭터를 찾을 수 없거나 삭제 권한이 없습니다." });
    }

    // 트랜잭션을 사용해 관련된 모든 데이터 삭제
    await prisma.$transaction(async (prisma) => {
      // 먼저 인벤토리 아이템 삭제
      await prisma.inventory.deleteMany({
        where: { characterId: character.characterId },
      });

      // 캐릭터 삭제
      await prisma.characters.delete({
        where: { characterId: character.characterId },
      });
    });

    return res.status(200).json({
      message: `${charactername} 캐릭터가 성공적으로 삭제되었습니다.`,
    });
  } catch (error) {
    console.error("캐릭터 삭제 오류:", error);
    return res
      .status(500)
      .json({ message: "캐릭터 삭제 중 서버 오류가 발생했습니다." });
  }
});

export default router;
