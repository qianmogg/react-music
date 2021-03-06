/**** React应用依赖组件 ****/
// core
import React, { Component } from 'react'
import { CSSTransition } from 'react-transition-group'
import classNames from 'classnames'
import { connect } from 'react-redux'
import { setFullScreen, setPlayState, setCurrentIndex, setCurrentSong, setPlayMode, setPlaylist } from 'store/actions'
/******* 第三方 组件库 *****/
import animations from 'create-keyframe-animation'
import Lyric from 'lyric-parser'
/**** 本地公用变量 公用函数 **/
import Scroll from 'component/scroll/scroll'
import { prefixStyle } from 'common/js/dom'
import { shuffle } from 'common/js/util'
import { playMode } from 'common/js/config'
/******* 本地 公用组件 *****/
/**** 当前组件的 子组件等 ***/
import ProgressBar from 'component/progress-bar/progress-bar'
import ProgressCircle from 'component/progress-circle/progress-circle'

const transform = prefixStyle('transform')
const transitionDuration = prefixStyle('transitionDuration')

@connect(state => ({ player: state.player }), {
  setFullScreen,
  setPlayState,
  setCurrentIndex,
  setCurrentSong,
  setPlayMode,
  setPlaylist
})
class Player extends Component {
  constructor(props) {
    super(props)

    this.state = {
      songReady: false,
      currentTime: 0,
      iconMode: 'icon-sequence',
      currentLyric: null,
      currentLineNum: 0,
      currentShow: 'cd',
      playingLyric: ''
    }

    this.touch = {}

    this.back = this.back.bind(this)
    this.open = this.open.bind(this)
    this._getPosAndScale = this._getPosAndScale.bind(this)
    this.entered = this.entered.bind(this)
    this.togglePlaying = this.togglePlaying.bind(this)
    this.next = this.next.bind(this)
    this.prev = this.prev.bind(this)
    this.ready = this.ready.bind(this)
    this.error = this.error.bind(this)
    this.updateTime = this.updateTime.bind(this)
    this.format = this.format.bind(this)
    this.onProgressBarChange = this.onProgressBarChange.bind(this)
    this.changeMode = this.changeMode.bind(this)
    this.end = this.end.bind(this)
    this.handleLyric = this.handleLyric.bind(this)
    this.middleTouchStart = this.middleTouchStart.bind(this)
    this.middleTouchMove = this.middleTouchMove.bind(this)
    this.middleTouchEnd = this.middleTouchEnd.bind(this)
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.player.currentSong !== this.props.player.currentSong) {
      this._w_currentSongFn(nextProps)
    }
    if (nextProps.player.playing !== this.props.player.playing) {
      this._w_playingFn(nextProps)
    }
    if (nextProps.player.mode !== this.props.player.mode) {
      this._w_iconModeFn(nextProps)
    }
  }
  enter(el) {
    el.style.display = 'block'

    const { x, y, scale } = this._getPosAndScale()

    let animation = {
      0: {
        // 因为 x, y, scale 这些值是动态获取的，单纯的css3动画不能获取，所以， 由 create-keyframe-animation 这个动画库来做桥接
        transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`
      },
      60: {
        transform: `translate3d(0, 0, 0) scale(1.1)`
      },
      100: {
        transform: `translate3d(0, 0, 0) scale(1)`
      }
    }
    animations.registerAnimation({
      name: 'move',
      animation,
      presets: {
        duration: 400,
        easing: 'linear'
      }
    })
    animations.runAnimation(this.refs.cdWrapper, 'move')
  }
  entered(el) {
    animations.unregisterAnimation('move')
    this.refs.cdWrapper.style.animation = ''
  }
  exit(el) {
    this.refs.cdWrapper.style.transition = 'all 4s'
    const { x, y, scale } = this._getPosAndScale()
    this.refs.cdWrapper.style[transform] = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
  }
  exited(el) {
    el.style.display = 'none'
    this.refs.cdWrapper.style.transition = ''
    this.refs.cdWrapper.style[transform] = ''
  }
  back() {
    this.props.setFullScreen(false)
  }
  open() {
    this.props.setFullScreen(true)
  }
  changeMode() {
    const mode = (this.props.player.mode + 1) % 3
    this.props.setPlayMode(mode)

    let list = null
    if (mode === playMode.random) {
      list = shuffle(this.props.player.sequenceList)
    } else {
      list = this.props.player.sequenceList
    }
    this.props.setPlaylist(list)
    this.resetCurrentIndex(list)
  }
  resetCurrentIndex(list) {
    let index = list.findIndex(item => {
      return item.id === this.props.player.currentSong.id
    })
    this.props.setCurrentIndex(index)
    this.props.setCurrentSong(index)
  }
  loop() {
    this.refs.audio.currentTime = 0
    this.refs.audio.play()

    if (this.state.currentLyric) {
      this.state.currentLyric.seek(0)
    }
  }
  next() {
    if (!this.state.songReady) {
      return
    }
    let index = this.props.player.currentIndex + 1
    if (index === this.props.player.playList.length) {
      index = 0
    }
    this.props.setCurrentIndex(index)
    this.props.setCurrentSong(index)

    if (!this.props.player.playing) {
      this.togglePlaying()
    }
    this.setState({ songReady: false })
  }
  prev() {
    if (!this.state.songReady) {
      return
    }
    if (this.props.player.playList.lenth === 1) {
      this.loop()
    } else {
      if (this.props.player.playList.length === 1) {
        this.loop()
      } else {
        let index = this.props.player.currentIndex - 1
        if (index === -1) {
          index = this.props.player.playList.length - 1
        }
        this.props.setCurrentIndex(index)
        this.props.setCurrentSong(index)

        if (!this.props.player.playing) {
          this.togglePlaying()
        }
        this.setState({ songReady: false })
      }
    }
  }
  onProgressBarChange(percent) {
    const currentTime = this.props.player.currentSong.duration * percent
    this.refs.audio.currentTime = this.props.player.currentSong.duration * percent
    if (!this.props.player.playing) {
      this.togglePlaying()
    }
    if (this.state.currentLyric) {
      this.state.currentLyric.seek(currentTime * 1000)
    }
  }
  togglePlaying(e) {
    if (e) {
      e.stopPropagation()
    }
    this.props.setPlayState(!this.props.player.playing)

    if (this.state.currentLyric) {
      this.state.currentLyric.togglePlay()
    }
  }
  ready() {
    this.setState({ songReady: true })
  }
  error() {
    this.setState({ songReady: true })
  }
  updateTime(e) {
    this.setState({ currentTime: e.target.currentTime })
  }
  end() {
    if (this.props.player.mode === playMode.loop) {
      this.loop()
    } else {
      this.next()
    }
  }
  format(interval) {
    interval = interval | 0
    const minute = (interval / 60) | 0
    const second = this._pad(interval % 60)
    return `${minute}:${second}`
  }
  getLyric() {
    let me = this
    this.props.player.currentSong
      .getLyric()
      .then(lyric => {
        this.setState({ currentLyric: new Lyric(lyric, me.handleLyric) })
        if (this.props.player.playing) {
          this.state.currentLyric.seek(this.state.currentTime * 1000)
        }
      })
      .catch(err => {
        this.setState({
          currentLyric: null,
          playingLyric: null,
          currentLineNum: 0
        })
      })
  }
  handleLyric({ lineNum, txt }) {
    this.setState({ currentLineNum: lineNum })
    const lyricLines = Array.from(this.refs.lyric.children)
    if (lineNum > 5) {
      let lineEl = lyricLines[lineNum - 5]
      this.refs.lyricList.scrollToElement(lineEl, 1000)
    } else {
      this.refs.lyricList.scrollTo(0, 0, 1000)
    }
    this.setState({ playingLyric: txt })
  }
  middleTouchStart(e) {
    e.stopPropagation()
    this.touch.initiated = true
    const touch = e.touches[0]
    this.touch.startX = touch.pageX
    this.touch.startY = touch.pageY
  }
  middleTouchMove(e) {
    e.stopPropagation()
    if (!this.touch.initiated) return
    const touch = e.touches[0]
    const deltaX = touch.pageX - this.touch.startX
    const deltaY = touch.pageY - this.touch.startY
    // 纵向滚动则什么都不做
    if (Math.abs(deltaY) > Math.abs(deltaX)) return
    const left = this.state.currentShow === 'cd' ? 0 : -window.innerWidth
    const offSetWidth = Math.min(0, Math.max(-window.innerWidth, left + deltaX))
    this.touch.percent = Math.abs(offSetWidth / window.innerWidth)
    // React 当中，通过 this.refs.Instance 方式拿到某个组件的实例。想要获取内部相应的元素，可以在这个 Instance 上面声明 ref，然后拿到这个 ref，这样就与我们平时获取 dom元素差不多了
    this.refs.lyricList.refs.oScroll.style[transform] = `translate3d(${offSetWidth}px, 0, 0)`
    this.refs.lyricList.refs.oScroll.style[transitionDuration] = 0

    this.refs.middleL.style.opacity = 1 - this.touch.percent
    this.refs.middleL.style[transitionDuration] = 0
  }
  middleTouchEnd() {
    let offSetWidth
    let opacity
    if (this.state.currentShow === 'cd') {
      if (this.touch.percent > 0.1) {
        offSetWidth = -window.innerWidth
        opacity = 0
        this.setState({ currentShow: 'lyric' })
      } else {
        offSetWidth = 0
        opacity = 1
      }
    } else {
      if (this.touch.percent < 0.9) {
        offSetWidth = 0
        this.setState({ currentShow: 'cd' })
        opacity = 1
      } else {
        offSetWidth = -window.innerWidth
        opacity = 0
      }
    }
    this.refs.lyricList.refs.oScroll.style[transform] = `translate3d(${offSetWidth}px, 0, 0)`
    const time = 300
    this.refs.lyricList.refs.oScroll.style[transitionDuration] = `${time}ms`

    this.refs.middleL.style.opacity = opacity
    this.refs.middleL.style[transitionDuration] = `${time}ms`
  }
  _pad(num, n = 2) {
    let len = num.toString().length
    while (len < n) {
      num = '0' + num
      len++
    }
    return num
  }
  _getPosAndScale() {
    const targetWidth = 40
    const paddingLeft = 40
    const paddingBottom = 30
    const paddingTop = 80
    const width = window.innerWidth * 0.8
    const scale = targetWidth / width
    const x = -(window.innerWidth / 2) - paddingLeft
    const y = window.innerHeight - paddingTop - width / 2 - paddingBottom
    return {
      x,
      y,
      scale
    }
  }
  _w_currentSongFn(nextProps) {
    if (nextProps.player.currentSong.id === this.props.player.currentSong.id) {
      return
    }

    if (this.state.currentLyric) {
      this.state.currentLyric.stop()
    }

    setTimeout(() => {
      this.refs.audio.play()
      this.getLyric()
    }, 1000)
  }
  _w_playingFn(nextProps) {
    const newPlaying = nextProps.player.playing
    const audio = this.refs.audio
    setTimeout(() => {
      newPlaying ? audio.play() : audio.pause()
    }, 20)
  }
  _w_iconModeFn(nextProps) {
    const newMode = nextProps.player.mode
    const mode =
      newMode === playMode.sequence ? 'icon-sequence' : newMode === playMode.loop ? 'icon-loop' : 'icon-random'
    this.setState({ iconMode: mode })
  }
  render() {
    const { player } = this.props
    const { currentSong } = player
    return (
      <div className="o-player">
        <CSSTransition
          in={player.fullScreen}
          timeout={400}
          classNames="player-transition"
          onEnter={el => this.enter(el)}
          onEntered={el => this.entered(el)}
          onExit={el => this.exit(el)}
          onExited={el => this.exited(el)}>
          <div className="normal-player">
            <div className="background">
              <img src={currentSong.image} width="100%" height="100%" alt="" />
            </div>
            <div className="top">
              <div className="back" onClick={this.back}>
                <i className="icon-back" />
              </div>
              <h1 className="title">{currentSong.name}</h1>
              <h2 className="subtitle">{currentSong.singer}</h2>
            </div>
            <div
              className="middle"
              onTouchStart={this.middleTouchStart}
              onTouchMove={this.middleTouchMove}
              onTouchEnd={this.middleTouchEnd}>
              <div className="middle-l" ref="middleL">
                <div className="cd-wrapper" ref="cdWrapper">
                  <div className="cd">
                    <img
                      src={currentSong.image}
                      alt=""
                      className={classNames('image', player.playing ? 'play' : 'play pause')}
                    />
                  </div>
                </div>
                <div className="playing-lyric-wrapper">
                  <div className="playing-lyric">{this.state.playingLyric}</div>
                </div>
              </div>
              <Scroll
                className="middle-r"
                ref="lyricList"
                data={this.state.currentLyric && this.state.currentLyric.lines}>
                <div className="lyric-wrapper">
                  {this.state.currentLyric ? (
                    <div ref="lyric">
                      {this.state.currentLyric.lines.map((line, index) => (
                        <p
                          className={classNames('text', { current: this.state.currentLineNum === index })}
                          key={line.time + index}>
                          {line.txt}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Scroll>
            </div>
            <div className="bottom">
              <div className="dot-wrapper">
                <span className={classNames('dot', { active: this.state.currentShow === 'cd' })} />
                <span className={classNames('dot', { active: this.state.currentShow === 'lyric' })} />
              </div>
              <div className="progress-wrapper">
                <span className="time tile-l">{this.format(this.state.currentTime)}</span>
                <div className="progress-bar-wrapper">
                  <ProgressBar
                    percent={this.state.currentTime / currentSong.duration}
                    percentChange={this.onProgressBarChange}
                  />
                </div>
                <span className="time time-r">{this.format(currentSong.duration)}</span>
              </div>
              <div className="operators">
                <div className={classNames(`icon i-left`)} onClick={this.changeMode}>
                  <i className={this.state.iconMode} />
                </div>
                <div className={classNames(`icon i-left`, this.state.songReady ? '' : 'disable')}>
                  <i className="icon-prev" onClick={this.prev} />
                </div>
                <div className={classNames(`icon i-center`, this.state.songReady ? '' : 'disable')}>
                  <i className={player.playing ? 'icon-pause' : 'icon-play'} onClick={this.togglePlaying} />
                </div>
                <div className={classNames(`icon i-right`, this.state.songReady ? '' : 'disable')}>
                  <i className="icon-next" onClick={this.next} />
                </div>
                <div className={classNames(`icon i-right`, this.state.songReady ? '' : 'disable')}>
                  <i className="icon icon-not-favorite" />
                </div>
              </div>
            </div>
          </div>
        </CSSTransition>
        {!player.fullScreen && Object.keys(player.currentSong).length ? (
          <div className="mini-player" onClick={this.open}>
            <div className="icon">
              <div className="imgWrapper">
                <img
                  alt="avatar"
                  src={currentSong.image}
                  className={classNames(player.playing ? 'play' : 'play pause')}
                  width="40"
                  height="40"
                />
              </div>
            </div>
            <div className="text">
              <h2 className="name">{currentSong.name}</h2>
              <p className="desc">{currentSong.singer}</p>
            </div>
            <div className="control">
              <ProgressCircle radius={32} percent={this.state.currentTime / currentSong.duration}>
                <i
                  className={classNames('icon-mini', player.playing ? 'icon-pause-mini' : 'icon-play-mini')}
                  onClick={this.togglePlaying}
                />
              </ProgressCircle>
            </div>
            <div className="control" />
            <div className="control">
              <i className="icon-playlist" />
            </div>
          </div>
        ) : null}
        <audio
          src={currentSong.url}
          ref="audio"
          onCanPlay={this.ready}
          onError={this.error}
          onTimeUpdate={this.updateTime}
          onEnded={this.end}
        />
      </div>
    )
  }
}

export default Player
