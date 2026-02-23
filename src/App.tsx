import { useEffect, useState } from 'react'
import './style.css'

type Player = {
  id: string
  name: string
}

type RoundEntry = {
  playerId: string
  delta: number
  rank: number | null
  extra: number
  special: 'none' | 'toi-trang' | 'dut-3-bich'
}

type Round = {
  id: number
  entries: RoundEntry[]
}

type DraftRound = Record<
  string,
  {
    rank: number | null
    extra: number
    special: 'none' | 'toi-trang' | 'dut-3-bich'
  }
>

type Rules = {
  rank1: number
  rank2: number
  rank3: number
  rank4: number
  toiTrang: number
  dut3Bich: number
  otherPenalty: number
  scoreLimit: number | null // null = không giới hạn
}

type View = 'roomList' | 'createRoom' | 'table'

type Room = {
  id: string
  name: string
  players: Player[]
  totals: Record<string, number>
  rounds: Round[]
  rules: Rules
}

type StoredState = {
  rooms: Room[]
  activeRoomId: string | null
}

const DEFAULT_RULES: Rules = {
  rank1: 3,
  rank2: 2,
  rank3: 1,
  rank4: 0,
  toiTrang: 6,
  dut3Bich: 9,
  otherPenalty: -3,
  scoreLimit: 51, // Mặc định giới hạn 51 điểm
}

export function App() {
  // danh sách các room
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [view, setView] = useState<View>('roomList')

  // input khi tạo room mới
  const [tableNameInput, setTableNameInput] =
    useState<string>('Xì dách mồng 1 Tết')
  const [playerNamesInput, setPlayerNamesInput] = useState<string[]>([
    'Người 1',
    'Người 2',
    'Người 3',
    'Người 4',
  ])
  const [rulesInput, setRulesInput] = useState<Rules>(DEFAULT_RULES)

  // popup thêm/sửa vòng cho room đang mở
  const [isAddingRound, setIsAddingRound] = useState(false)
  const [isEditingLastRound, setIsEditingLastRound] = useState(false)
  const [draft, setDraft] = useState<DraftRound>({})
  
  // Hiệu ứng pháo bông
  const [fireworks, setFireworks] = useState<{ id: number; playerName: string }[]>([])

  const activeRoom = rooms.find(r => r.id === activeRoomId) || null

  // Load từ localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem('tinh-diem-rooms-v1')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as StoredState
      if (Array.isArray(parsed.rooms)) {
        // Đảm bảo các room cũ có scoreLimit mặc định
        const normalizedRooms = parsed.rooms.map(room => ({
          ...room,
          rules: {
            ...room.rules,
            scoreLimit: room.rules.scoreLimit ?? null,
          },
        }))
        setRooms(normalizedRooms)
        setActiveRoomId(parsed.activeRoomId ?? null)
        setView(parsed.activeRoomId ? 'table' : 'roomList')
      }
    } catch {
      // ignore
    }
  }, [])

  // Lưu vào localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const data: StoredState = { rooms, activeRoomId }
    window.localStorage.setItem('tinh-diem-rooms-v1', JSON.stringify(data))
  }, [rooms, activeRoomId])

  const handleCreateRoom = () => {
    const trimmed = playerNamesInput.map(name => name.trim() || 'Người chơi')
    const players: Player[] = trimmed.map((name, index) => ({
      id: `P${index + 1}`,
      name,
    }))

    const totals: Record<string, number> = {}
    players.forEach(p => {
      totals[p.id] = 0
    })

    const id = `room-${Date.now()}`
    const newRoom: Room = {
      id,
      name: tableNameInput.trim() || 'Bàn mới',
      players,
      totals,
      rounds: [],
      rules: rulesInput,
    }

    setRooms(prev => [...prev, newRoom])
    setActiveRoomId(id)
    setView('table')
  }

  const handleDeleteRoom = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Ngăn click vào room card
    if (window.confirm('Bạn có chắc muốn xóa bàn chơi này?')) {
      setRooms(prev => prev.filter(r => r.id !== roomId))
      if (activeRoomId === roomId) {
        setActiveRoomId(null)
        setView('roomList')
      }
    }
  }

  const openAddRound = () => {
    if (!activeRoom) return
    setIsEditingLastRound(false)
    const emptyDraft: DraftRound = {}
    for (const p of activeRoom.players) {
      emptyDraft[p.id] = { rank: null, extra: 0, special: 'none' }
    }
    setDraft(emptyDraft)
    setIsAddingRound(true)
  }

  const closeAddRound = () => {
    setIsAddingRound(false)
    setIsEditingLastRound(false)
  }

  const openEditLastRound = () => {
    if (!activeRoom || activeRoom.rounds.length === 0) return
    const last = activeRoom.rounds[activeRoom.rounds.length - 1]
    const nextDraft: DraftRound = {}
    for (const p of activeRoom.players) {
      const entry = last.entries.find(e => e.playerId === p.id)
      nextDraft[p.id] = {
        rank: entry?.rank ?? null,
        extra: entry?.extra ?? 0,
        special: entry?.special ?? 'none',
      }
    }
    setDraft(nextDraft)
    setIsEditingLastRound(true)
    setIsAddingRound(true)
  }

  const handleRankChange = (playerId: string, rank: number) => {
    setDraft(prev => {
      const next: DraftRound = { ...prev }

      for (const id of Object.keys(next)) {
        if (id !== playerId && next[id]?.rank === rank) {
          next[id] = { ...next[id], rank: null }
        }
      }

      const current =
        next[playerId] ?? {
          rank: null,
          extra: 0,
          special: 'none' as const,
        }

      const newRank = current.rank === rank ? null : rank

      next[playerId] = {
        ...current,
        rank: newRank,
        special: 'none',
      }

      return next
    })
  }

  const handleExtraChange = (playerId: string, value: number) => {
    setDraft(prev => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? { rank: null, extra: 0, special: 'none' }),
        extra: value,
      },
    }))
  }

  const handleExtraDelta = (playerId: string, delta: number) => {
    setDraft(prev => {
      const current = prev[playerId] ?? {
        rank: null,
        extra: 0,
        special: 'none' as const,
      }
      return {
        ...prev,
        [playerId]: {
          ...current,
          extra: (current.extra ?? 0) + delta,
        },
      }
    })
  }

  const handleSpecialChange = (
    playerId: string,
    special: 'toi-trang' | 'dut-3-bich',
  ) => {
    setDraft(prev => {
      const next: DraftRound = { ...prev }

      for (const id of Object.keys(next)) {
        if (id !== playerId && next[id]) {
          next[id] = { ...next[id], special: 'none' }
        }
      }

      const current =
        next[playerId] ?? {
          rank: null,
          extra: 0,
          special: 'none' as const,
        }

      const toggledSpecial =
        current.special === special ? ('none' as const) : special

      next[playerId] = {
        ...current,
        rank: toggledSpecial === 'none' ? current.rank : null,
        special: toggledSpecial,
      }

      return next
    })
  }

  const computeRoundEntries = (room: Room, d: DraftRound): RoundEntry[] => {
    const playersList = room.players
    const rules = room.rules

    let specialPlayerId: string | null = null
    let specialType: 'toi-trang' | 'dut-3-bich' | null = null

    for (const p of playersList) {
      const info = d[p.id]
      if (info && info.special !== 'none') {
        specialPlayerId = p.id
        specialType = info.special
        break
      }
    }

    return playersList.map(player => {
      const info =
        d[player.id] ??
        ({
          rank: null,
          extra: 0,
          special: 'none',
        } as DraftRound[string])

      let delta = 0

      if (info.rank === 1) {
        delta += rules.rank1
      } else if (info.rank === 2) {
        delta += rules.rank2
      } else if (info.rank === 3) {
        delta += rules.rank3
      } else if (info.rank === 4) {
        delta += rules.rank4
      }

      delta += info.extra

      if (specialPlayerId && specialType) {
        if (player.id === specialPlayerId) {
          delta += specialType === 'toi-trang' ? rules.toiTrang : rules.dut3Bich
        } else if (specialType === 'dut-3-bich') {
          delta += rules.otherPenalty
        }
      }

      return {
        playerId: player.id,
        delta,
        rank: info.rank,
        extra: info.extra,
        special: info.special,
      }
    })
  }

  const calculateDeltaForPlayer = (playerId: string): number => {
    if (!activeRoom) return 0
    const entries = computeRoundEntries(activeRoom, draft)
    const entry = entries.find(e => e.playerId === playerId)
    return entry?.delta ?? 0
  }

  const updateActiveRoom = (updater: (room: Room) => Room) => {
    setRooms(prev =>
      prev.map(room =>
        room.id === activeRoomId ? updater(room) : room,
      ),
    )
  }

  const triggerFireworks = (playerName: string) => {
    const id = Date.now()
    setFireworks(prev => [...prev, { id, playerName }])
    // Tự động xóa sau 3 giây
    setTimeout(() => {
      setFireworks(prev => prev.filter(f => f.id !== id))
    }, 3000)
  }

  const checkScoreLimit = (
    oldTotals: Record<string, number>,
    newTotals: Record<string, number>,
    players: Player[],
    scoreLimit: number | null,
  ) => {
    if (scoreLimit === null) return
    
    for (const player of players) {
      const oldScore = oldTotals[player.id] ?? 0
      const newScore = newTotals[player.id] ?? 0
      
      // Kiểm tra nếu điểm mới vượt quá giới hạn và điểm cũ chưa vượt
      if (oldScore <= scoreLimit && newScore > scoreLimit) {
        triggerFireworks(player.name)
      }
    }
  }

  const handleSaveRound = () => {
    if (!activeRoom) return

    const deltas = computeRoundEntries(activeRoom, draft)

    if (!isEditingLastRound) {
      const hasChange = deltas.some(d => d.delta !== 0)
      if (!hasChange) {
        closeAddRound()
        return
      }

      updateActiveRoom(room => {
        const oldTotals = { ...room.totals }
        const nextTotals: Record<string, number> = { ...room.totals }
        for (const d of deltas) {
          nextTotals[d.playerId] = (nextTotals[d.playerId] ?? 0) + d.delta
        }
        
        // Kiểm tra giới hạn điểm
        checkScoreLimit(oldTotals, nextTotals, room.players, room.rules.scoreLimit)
        
        return {
          ...room,
          totals: nextTotals,
          rounds: [
            ...room.rounds,
            { id: room.rounds.length + 1, entries: deltas },
          ],
        }
      })
    } else {
      if (activeRoom.rounds.length === 0) {
        closeAddRound()
        return
      }

      const previousLast = activeRoom.rounds[activeRoom.rounds.length - 1]

      updateActiveRoom(room => {
        const oldTotals = { ...room.totals }
        const nextTotals: Record<string, number> = { ...room.totals }
        for (const player of room.players) {
          const oldDelta =
            previousLast.entries.find(e => e.playerId === player.id)
              ?.delta ?? 0
          const newDelta =
            deltas.find(e => e.playerId === player.id)?.delta ?? 0
          nextTotals[player.id] =
            (nextTotals[player.id] ?? 0) - oldDelta + newDelta
        }

        // Kiểm tra giới hạn điểm
        checkScoreLimit(oldTotals, nextTotals, room.players, room.rules.scoreLimit)

        const updatedRounds = [...room.rounds]
        updatedRounds[updatedRounds.length - 1] = {
          ...updatedRounds[updatedRounds.length - 1],
          entries: deltas,
        }

        return {
          ...room,
          totals: nextTotals,
          rounds: updatedRounds,
        }
      })
    }

    closeAddRound()
  }

  // ===== VIEW: DANH SÁCH BÀN =====
  if (view === 'roomList') {
    return (
      <div className="app-root">
        <header className="app-header">
          <div className="table-title">
            <h1>Danh sách bàn chơi</h1>
            <p className="subline">
              {rooms.length > 0
                ? 'Chọn bàn để tiếp tục hoặc tạo bàn mới'
                : 'Chưa có bàn nào, tạo bàn mới'}
            </p>
          </div>
        </header>
        <main className="app-main">
          <section className="room-list-section">
            {rooms
              .slice()
              .reverse()
              .map(room => (
                <div
                  key={room.id}
                  className={
                    'room-card' +
                    (room.id === activeRoomId ? '' : ' archived')
                  }
                >
                  <button
                    type="button"
                    className="room-card-content"
                    onClick={() => {
                      setActiveRoomId(room.id)
                      setView('table')
                    }}
                  >
                    <div className="room-title">{room.name}</div>
                    <div className="room-meta">
                      {room.players.length} người chơi · {room.rounds.length} vòng
                    </div>
                  </button>
                  <button
                    type="button"
                    className="room-delete-button"
                    onClick={e => handleDeleteRoom(room.id, e)}
                    aria-label="Xóa bàn chơi"
                  >
                    🗑️
                  </button>
                </div>
              ))}
          </section>
        </main>
        <button
          className="add-round-button"
          type="button"
          onClick={() => setView('createRoom')}
        >
          + Tạo bàn mới
        </button>
      </div>
    )
  }

  // ===== VIEW: TẠO BÀN =====
  if (view === 'createRoom') {
    return (
      <div className="app-root">
        <header className="app-header">
          <button
            className="back-button"
            aria-label="Quay lại danh sách bàn"
            type="button"
            onClick={() => setView('roomList')}
          >
            ←
          </button>
          <div className="table-title">
            <h1>Tạo bàn chơi</h1>
            <p className="subline">Nhập tên 4 người và tên bàn</p>
          </div>
        </header>
        <main className="app-main">
          <section className="create-room">
            <label className="field-label">
              Tên bàn
              <input
                className="text-input"
                value={tableNameInput}
                onChange={e => setTableNameInput(e.target.value)}
                placeholder="Ví dụ: Xì dách mồng 1 Tết"
              />
            </label>
            <div className="players-grid">
              {playerNamesInput.map((name, index) => (
                <label key={index} className="field-label">
                  Người chơi {index + 1}
                  <input
                    className="text-input"
                    value={name}
                    onChange={e => {
                      const next = [...playerNamesInput]
                      next[index] = e.target.value
                      setPlayerNamesInput(next)
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="rules-box">
              <p className="section-label">Cấu hình luật</p>
              <div className="rules-grid">
                <label className="field-label small">
                  Nhất
                  <input
                    type="number"
                    className="text-input"
                    value={rulesInput.rank1}
                    onChange={e =>
                      setRulesInput(r => ({
                        ...r,
                        rank1: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <label className="field-label small">
                  Nhì
                  <input
                    type="number"
                    className="text-input"
                    value={rulesInput.rank2}
                    onChange={e =>
                      setRulesInput(r => ({
                        ...r,
                        rank2: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <label className="field-label small">
                  Ba
                  <input
                    type="number"
                    className="text-input"
                    value={rulesInput.rank3}
                    onChange={e =>
                      setRulesInput(r => ({
                        ...r,
                        rank3: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <label className="field-label small">
                  Bét
                  <input
                    type="number"
                    className="text-input"
                    value={rulesInput.rank4}
                    onChange={e =>
                      setRulesInput(r => ({
                        ...r,
                        rank4: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="special-rules-box">
                <p className="special-rules-title">Luật đặc biệt</p>
                <div className="rules-grid special">
                  <label className="field-label small">
                    Tới trắng
                    <input
                      type="number"
                      className="text-input"
                      value={rulesInput.toiTrang}
                      onChange={e =>
                        setRulesInput(r => ({
                          ...r,
                          toiTrang: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </label>
                  <label className="field-label small">
                    Đút 3 bích
                    <input
                      type="number"
                      className="text-input"
                      value={rulesInput.dut3Bich}
                      onChange={e =>
                        setRulesInput(r => ({
                          ...r,
                          dut3Bich: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </label>
                  <label className="field-label small">
                    Phạt mỗi người còn lại (khi Đút 3 bích)
                    <input
                      type="number"
                      className="text-input"
                      value={rulesInput.otherPenalty}
                      onChange={e =>
                        setRulesInput(r => ({
                          ...r,
                          otherPenalty: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="score-limit-box">
                <label className="field-label">
                  Giới hạn điểm (để trống nếu không giới hạn)
                  <input
                    type="number"
                    className="text-input"
                    value={rulesInput.scoreLimit ?? ''}
                    onChange={e => {
                      const value = e.target.value.trim()
                      setRulesInput(r => ({
                        ...r,
                        scoreLimit: value === '' ? null : Number(value) || null,
                      }))
                    }}
                    placeholder="Ví dụ: 50"
                  />
                </label>
                <p className="score-limit-hint">
                  Khi ai đó đạt điểm lớn hơn giới hạn này sẽ có pháo bông chúc mừng 🎆
                </p>
              </div>
            </div>
          </section>
        </main>
        <button
          className="add-round-button"
          type="button"
          onClick={handleCreateRoom}
        >
          Bắt đầu chơi
        </button>
      </div>
    )
  }

  // ===== VIEW: BÀN ĐANG CHƠI =====
  if (view === 'table' && !activeRoom) {
    return null
  }

  const room = activeRoom!

  return (
    <div className="app-root">
      <header className="app-header">
        <button
          className="back-button"
          aria-label="Quay lại danh sách bàn"
          type="button"
          onClick={() => setView('roomList')}
        >
          ←
        </button>
        <div className="table-title">
          <h1>{room.name}</h1>
          <p className="subline">{room.players.length} người chơi</p>
        </div>
      </header>

      <main className="app-main">
        <section className="ranking-section">
          <p className="section-label">Xếp hạng</p>
          <div className="ranking-list">
            {[...room.players]
              .sort(
                (a, b) =>
                  (room.totals[b.id] ?? 0) - (room.totals[a.id] ?? 0),
              )
              .map(player => (
              <div key={player.id} className="ranking-card">
                <div className="avatar-circle">
                  {player.name.trim()[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="ranking-name">{player.name}</div>
                <div
                  className={
                    'ranking-score ' +
                    ((room.totals[player.id] ?? 0) >= 0
                      ? 'score-positive'
                      : 'score-negative')
                  }
                >
                  {(room.totals[player.id] ?? 0) > 0
                    ? `+${room.totals[player.id]}`
                    : room.totals[player.id] ?? 0}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="history-section">
          <button className="collapse-header" type="button">
            <span className="collapse-icon">⏱</span>
            <span className="collapse-title">Lịch sử trận đấu</span>
          </button>

          {room.rounds.length > 0 && (
            <button
              type="button"
              className="edit-last-button"
              onClick={openEditLastRound}
            >
              Sửa vòng cuối
            </button>
          )}

          <div className="round-list">
            {room.rounds
              .slice()
              .reverse()
              .map(round => (
              <div key={round.id} className="round-card">
                <div className="round-header">
                  <span className="round-index">{round.id}</span>
                  <span className="round-label">Vòng tiêu chuẩn</span>
                  <span className="round-time">—</span>
                </div>
                <div className="round-players">
                  {round.entries.map(entry => {
                    const player = room.players.find(
                      p => p.id === entry.playerId,
                    )
                    if (!player) return null
                    return (
                      <div key={player.id} className="round-row">
                        <span className="round-player-name">{player.name}</span>
                        <span
                          className={
                            'round-player-delta ' +
                            (entry.delta >= 0 ? 'score-positive' : 'score-negative')
                          }
                        >
                          {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <button className="add-round-button" type="button" onClick={openAddRound}>
        ✏️ Thêm vòng
      </button>

      {isAddingRound && (
        <div className="modal-backdrop">
          <div className="round-modal">
            <header className="round-modal-header">
              <button
                className="back-button"
                type="button"
                onClick={closeAddRound}
              >
                ←
              </button>
              <h2>Thêm / sửa vòng</h2>
            </header>

            <div className="special-toggle">
              <div>
                <div className="special-title">Xếp hạng vòng</div>
                <div className="special-subtitle">
                  Chọn nhất / nhì / ba / bét cho từng người
                </div>
              </div>
              <button
                className="save-text-button"
                type="button"
                onClick={handleSaveRound}
              >
                {isEditingLastRound ? 'Cập nhật' : 'Lưu'}
              </button>
            </div>

            <p className="scores-label">Scores</p>

            <div className="scores-list">
              {[...room.players]
                .sort(
                  (a, b) =>
                    (room.totals[b.id] ?? 0) - (room.totals[a.id] ?? 0),
                )
                .map(player => {
                const d = draft[player.id]
                const currentDelta = calculateDeltaForPlayer(player.id)
                return (
                  <div key={player.id} className="score-row">
                    <div className="score-player">
                      <div className="avatar-circle small">
                        {player.name.trim()[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span className="score-player-name">{player.name}</span>
                    </div>
                    <div className="score-deltas">
                      {[1, 2, 3, 4].map(rank => (
                        <button
                          key={rank}
                          type="button"
                          className={
                            'delta-chip rank-chip ' +
                            (d?.rank === rank ? 'rank-selected' : '')
                          }
                          onClick={() => handleRankChange(player.id, rank)}
                        >
                          {rank === 1
                            ? 'Nhất'
                            : rank === 2
                              ? 'Nhì'
                              : rank === 3
                                ? 'Ba'
                                : 'Bét'}
                        </button>
                      ))}
                    </div>
                    <div className="special-options">
                      <button
                        type="button"
                        className={
                          'delta-chip special-chip ' +
                          (d?.special === 'toi-trang' ? 'special-selected' : '')
                        }
                        onClick={() => handleSpecialChange(player.id, 'toi-trang')}
                      >
                        Tới trắng
                      </button>
                      <button
                        type="button"
                        className={
                          'delta-chip special-chip ' +
                          (d?.special === 'dut-3-bich' ? 'special-selected' : '')
                        }
                        onClick={() => handleSpecialChange(player.id, 'dut-3-bich')}
                      >
                        Đút 3 bích
                      </button>
                    </div>
                    <div className="extra-chips">
                      {[-4, -3, -2, -1, 1, 2, 3, 4].map(step => (
                        <button
                          key={step}
                          type="button"
                          className="delta-chip extra-chip"
                          onClick={() => handleExtraDelta(player.id, step)}
                        >
                          {step > 0 ? `+${step}` : step}
                        </button>
                      ))}
                    </div>
                    <div className="score-extra-wrapper">
                      <input
                        type="number"
                        className="extra-input"
                        value={d?.extra ?? 0}
                        onChange={e =>
                          handleExtraChange(player.id, Number(e.target.value) || 0)
                        }
                      />
                      <div
                        className={
                          'score-current ' +
                          (currentDelta >= 0 ? 'score-positive' : 'score-negative')
                        }
                      >
                        {currentDelta > 0 ? `+${currentDelta}` : currentDelta}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="note-input-wrapper">
              <input
                type="text"
                className="note-input"
                placeholder="Note (Optional)"
              />
            </div>
          </div>
        </div>
      )}

      {/* Component pháo bông */}
      {fireworks.map(firework => (
        <Fireworks key={firework.id} playerName={firework.playerName} />
      ))}
    </div>
  )
}

// Component pháo bông
function Fireworks({ playerName }: { playerName: string }) {
  return (
    <div className="fireworks-container">
      <div className="fireworks-content">
        <div className="fireworks-emoji">🎆</div>
        <div className="fireworks-text">Chúc mừng {playerName}!</div>
        <div className="fireworks-particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="firework-particle"
              style={{
                '--delay': `${i * 0.05}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default App


