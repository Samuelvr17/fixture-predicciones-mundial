export const formatSlotLabel = (slot?: string | null) => {
  if (!slot) return undefined;

  const previousMatchSlot = slot.match(/^([WL])(\d+)$/);
  if (previousMatchSlot) {
    const [, resultType, matchNumber] = previousMatchSlot;
    return `${resultType === 'W' ? 'Ganador' : 'Perdedor'} P${matchNumber}`;
  }

  const groupPositionSlot = slot.match(/^([12])([A-L])$/);
  if (groupPositionSlot) {
    const [, position, groupCode] = groupPositionSlot;
    return `${position}.º Grupo ${groupCode}`;
  }

  const bestThirdSlot = slot.match(/^3([A-L](?:\/[A-L])*)?$/);
  if (bestThirdSlot) {
    const [, groups] = bestThirdSlot;
    return groups ? `Mejor 3.º ${groups}` : 'Mejor 3.º';
  }

  return `Origen ${slot}`;
};

export const getSlotMatchNumber = (slot?: string | null) => {
  if (!slot) return undefined;

  const previousMatchSlot = slot.match(/^[WL](\d+)$/);
  if (!previousMatchSlot) return undefined;

  return Number(previousMatchSlot[1]);
};
