import express from "express";
import { prisma } from "../utils/prisma/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddlewares from "../middlewares/auth.middlewares.js";

const router = express.Router();

/** 아이템 생성 api **/
router.post("/items", authMiddlewares, async (req, res) => {
  const { name, health, power, price, description } = req.body; // 아이템 정보
  const { userId } = req.user; // 인증된 사용자 ID 가져오기

  try {
    // 사용자의 캐릭터 찾기
    const character = await prisma.characters.findFirst({
      where: { userId: userId },
    });

    if (!character) {
      return res.status(404).json({ message: "캐릭터를 먼저 생성해주세요." });
    }

    // 인벤토리에 아이템 중복 여부 확인 (이름으로 확인)
    const existingItem = await prisma.inventory.findFirst({
      where: {
        characterId: character.characterId,
        name: name,
      },
    });

    if (existingItem) {
      return res
        .status(400)
        .json({ message: "이미 인벤토리에 존재하는 아이템입니다." });
    }

    // 아이템 생성
    const newItem = await prisma.items.create({
      data: {
        name,
        health,
        power,
        price,
        description,
      },
    });

    // 인벤토리에 아이템 추가
    const newInventoryItem = await prisma.inventory.create({
      data: {
        characterId: character.characterId,
        itemId: newItem.itemId,
        name: newItem.name,
        stats: { health: newItem.health, power: newItem.power }, // JSON 형태로 저장
        price: newItem.price,
      },
    });

    return res.status(201).json({
      message: "아이템 생성 및 인벤토리에 추가가 완료되었습니다.",

      inventory: newInventoryItem,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "아이템 생성 및 인벤토리 추가 중 문제가 발생했습니다.",
      error,
    });
  }
});

/** 아이템 수정 api **/
router.put("/items/:itemId", authMiddlewares, async (req, res) => {
  const { itemId } = req.params; // URI의 parameter로 전달받은 itemId
  const { name, health, power, description } = req.body; // 새로운 아이템 데이터

  try {
    // 데이터 검증
    if (!name && !health && !power && !description) {
      return res.status(400).json({
        message: "수정할 아이템 이름 또는 능력치를 입력해주세요.",
      });
    }

    // 아이템 조회
    const existingItem = await prisma.items.findUnique({
      where: { itemId: parseInt(itemId) },
    });

    if (!existingItem) {
      return res.status(404).json({
        message: "수정하려는 아이템이 존재하지 않습니다.",
      });
    }

    // 수정 데이터 준비 (가격은 수정하지 않음)
    const updatedData = {
      name: name || existingItem.name, // 이름 변경 없으면 기존 이름 유지
      health: health ?? existingItem.health, // health가 없으면 기존 값 유지
      power: power ?? existingItem.power, // power가 없으면 기존 값 유지
      price: existingItem.price, // 가격은 수정 금지
      description: description || existingItem.description, // 설명이 없으면 기존 설명 유지
    };

    // 아이템 업데이트
    const updatedItem = await prisma.items.update({
      where: { itemId: parseInt(itemId) },
      data: updatedData,
    });

    return res.status(200).json({
      message: "아이템이 성공적으로 수정되었습니다.",
      item: updatedItem,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "아이템 수정 중 문제가 발생했습니다.",
      error: error.message,
    });
  }
});

/** 아이템 목록조회 API **/
router.get("/inventory/:characterId", authMiddlewares, async (req, res) => {
  const { characterId } = req.params; // URL 파라미터로 전달된 characterId

  try {
    // 해당 캐릭터의 인벤토리 아이템 조회
    const inventoryItems = await prisma.inventory.findMany({
      where: { characterId: parseInt(characterId) }, // 캐릭터 ID로 필터링
      include: {
        item: true, // 아이템의 세부 정보도 포함
      },
    });

    if (inventoryItems.length === 0) {
      return res.status(404).json({
        message: "이 캐릭터의 인벤토리에 아이템이 없습니다.",
      });
    }

    // 응답 데이터 포맷
    const response = inventoryItems.map((inventoryItem) => ({
      inventoryId: inventoryItem.inventoryId,
      item: {
        id: inventoryItem.item.itemId, // 아이템의 id
        name: inventoryItem.item.name, // 아이템의 이름
        stats: {
          // 아이템의 스탯 (health, power)
          health: inventoryItem.item.health,
          power: inventoryItem.item.power,
        },
        price: inventoryItem.item.price, // 아이템의 가격
      },
    }));

    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "인벤토리 아이템을 조회하는 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
});

/** 아이템 상세조회 **/
router.get("/items/:itemId", authMiddlewares, async (req, res) => {
  const { itemId } = req.params; // URI 파라미터에서 itemId를 가져옴

  try {
    // 아이템 조회
    const item = await prisma.items.findUnique({
      where: { itemId: parseInt(itemId) }, // itemId를 정수로 변환하여 조회
    });

    // 아이템이 없으면 404 응답
    if (!item) {
      return res.status(404).json({ message: "아이템을 찾을 수 없습니다." });
    }

    // 아이템 정보 반환
    return res.status(200).json({
      itemId: item.itemId,
      name: item.name,
      health: item.health,
      power: item.power,
      price: item.price,
      description: item.description,
    });
  } catch (error) {
    console.error("아이템 상세 조회 오류:", error);
    return res.status(400).json({ error: error.message });
  }
});

export default router;
