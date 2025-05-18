'use client'

import type React from 'react'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
	Upload,
	ZoomIn,
	ZoomOut,
	Download,
	RefreshCw,
	Settings,
	ChevronDown,
	ChevronUp,
} from 'lucide-react'
import { useMobile } from '@/hooks/use-mobile'

// Default dimensions
const DEFAULT_TEMPLATE_WIDTH_MM = 50 // 2 inches
const DEFAULT_TEMPLATE_HEIGHT_MM = 70 // 2.75 inches
const DEFAULT_MIN_FACE_HEIGHT_MM = 31 // 1.25 inches
const DEFAULT_MAX_FACE_HEIGHT_MM = 36 // 1.4375 inches

// Conversion factors
const MM_TO_INCH = 0.0393701
const MM_TO_CM = 0.1
const CM_TO_MM = 10
const INCH_TO_MM = 25.4
const PX_PER_INCH = 96 // Standard web resolution

// Resolution multiplier for higher quality output
const RESOLUTION_MULTIPLIER = 4 // 4x the standard resolution

type UnitType = 'mm' | 'cm' | 'in'

export function PhotoEditor() {
	// Dimensions state
	const [templateWidth, setTemplateWidth] = useState(DEFAULT_TEMPLATE_WIDTH_MM)
	const [templateHeight, setTemplateHeight] = useState(
		DEFAULT_TEMPLATE_HEIGHT_MM
	)
	const [minFaceHeight, setMinFaceHeight] = useState(DEFAULT_MIN_FACE_HEIGHT_MM)
	const [maxFaceHeight, setMaxFaceHeight] = useState(DEFAULT_MAX_FACE_HEIGHT_MM)
	const [units, setUnits] = useState<UnitType>('mm')
	const [showSettings, setShowSettings] = useState(false)

	// Input field states to track intermediate values
	const [templateWidthInput, setTemplateWidthInput] = useState(
		DEFAULT_TEMPLATE_WIDTH_MM.toString()
	)
	const [templateHeightInput, setTemplateHeightInput] = useState(
		DEFAULT_TEMPLATE_HEIGHT_MM.toString()
	)
	const [minFaceHeightInput, setMinFaceHeightInput] = useState(
		DEFAULT_MIN_FACE_HEIGHT_MM.toString()
	)
	const [maxFaceHeightInput, setMaxFaceHeightInput] = useState(
		DEFAULT_MAX_FACE_HEIGHT_MM.toString()
	)

	// Image editing state
	const [image, setImage] = useState<HTMLImageElement | null>(null)
	const [zoom, setZoom] = useState<number>(1)
	const [position, setPosition] = useState({ x: 0, y: 0 })
	const [isDragging, setIsDragging] = useState(false)
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
	const [dimensions, setDimensions] = useState({
		width: 0,
		height: 0,
		scale: 0,
	})

	const canvasRef = useRef<HTMLCanvasElement>(null)
	const previewCanvasRef = useRef<HTMLCanvasElement>(null)
	const highResCanvasRef = useRef<HTMLCanvasElement>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const isMobile = useMobile()

	// Convert dimensions to mm for internal calculations
	const getDimensionsInMm = useCallback(() => {
		let widthMm = templateWidth
		let heightMm = templateHeight
		let minFaceMm = minFaceHeight
		let maxFaceMm = maxFaceHeight

		if (units === 'cm') {
			widthMm = templateWidth * CM_TO_MM
			heightMm = templateHeight * CM_TO_MM
			minFaceMm = minFaceHeight * CM_TO_MM
			maxFaceMm = maxFaceHeight * CM_TO_MM
		} else if (units === 'in') {
			widthMm = templateWidth * INCH_TO_MM
			heightMm = templateHeight * INCH_TO_MM
			minFaceMm = minFaceHeight * INCH_TO_MM
			maxFaceMm = maxFaceHeight * INCH_TO_MM
		}

		return {
			widthMm,
			heightMm,
			minFaceMm,
			maxFaceMm,
		}
	}, [templateWidth, templateHeight, minFaceHeight, maxFaceHeight, units])

	// Helper function to draw an oval
	const drawOval = (
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		width: number,
		height: number
	) => {
		const radiusX = width / 2
		const radiusY = height / 2

		ctx.beginPath()
		ctx.ellipse(x, y, radiusX, radiusY, 0, 0, 2 * Math.PI)
		ctx.stroke()
	}

	// Function to draw the template guides
	const drawTemplateGuides = useCallback(
		(ctx: CanvasRenderingContext2D) => {
			const { width, height, scale } = dimensions
			const { minFaceMm, maxFaceMm } = getDimensionsInMm()

			// Center point of the canvas
			const centerX = width / 2
			const centerY = height / 2

			// Calculate oval dimensions
			const minFaceHeightPx = minFaceMm * MM_TO_INCH * PX_PER_INCH * scale
			const maxFaceHeightPx = maxFaceMm * MM_TO_INCH * PX_PER_INCH * scale
			const ovalWidth = minFaceHeightPx * 0.75 // Approximate width-to-height ratio for face

			// Draw the min and max ovals
			ctx.strokeStyle = '#cccccc'
			ctx.lineWidth = 1
			ctx.setLineDash([5, 5])

			// Min face oval
			drawOval(ctx, centerX, centerY, ovalWidth, minFaceHeightPx)

			// Max face oval
			ctx.strokeStyle = '#999999'
			drawOval(
				ctx,
				centerX,
				centerY,
				ovalWidth * (maxFaceHeightPx / minFaceHeightPx),
				maxFaceHeightPx
			)

			// Draw the shoulder guide lines
			ctx.beginPath()
			const shoulderY = centerY + minFaceHeightPx / 2
			ctx.moveTo(centerX - ovalWidth / 2, shoulderY)
			ctx.lineTo(centerX - ovalWidth, shoulderY + ovalWidth / 2)
			ctx.moveTo(centerX + ovalWidth / 2, shoulderY)
			ctx.lineTo(centerX + ovalWidth, shoulderY + ovalWidth / 2)
			ctx.stroke()

			// Reset line dash
			ctx.setLineDash([])

			// Draw the main oval guide
			ctx.strokeStyle = '#000000'
			ctx.lineWidth = 2
			drawOval(
				ctx,
				centerX,
				centerY,
				ovalWidth * 1.1,
				(minFaceHeightPx + maxFaceHeightPx) / 2
			)

			// Add measurement labels
			ctx.fillStyle = '#000000'
			ctx.font = '10px Arial'
			ctx.textAlign = 'center'

			// Width label
			ctx.fillText(`${templateWidth.toFixed(1)}${units}`, centerX, height - 5)

			// Height label
			ctx.save()
			ctx.translate(width - 5, centerY)
			ctx.rotate(Math.PI / 2)
			ctx.fillText(`${templateHeight.toFixed(1)}${units}`, 0, 0)
			ctx.restore()

			// Face height labels
			ctx.fillText(
				`Min: ${minFaceHeight.toFixed(1)}${units}`,
				centerX,
				centerY - minFaceHeightPx / 2 - 5
			)
			ctx.fillText(
				`Max: ${maxFaceHeight.toFixed(1)}${units}`,
				centerX,
				centerY - maxFaceHeightPx / 2 - 5
			)
		},
		[
			dimensions,
			getDimensionsInMm,
			minFaceHeight,
			maxFaceHeight,
			templateWidth,
			templateHeight,
			units,
		]
	)

	// Update the preview canvas (without guidelines)
	const updatePreviewCanvas = useCallback(() => {
		if (!previewCanvasRef.current || dimensions.width === 0 || !image) return

		const canvas = previewCanvasRef.current
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		// Set canvas dimensions
		canvas.width = dimensions.width
		canvas.height = dimensions.height

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height)

		// Draw background
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, canvas.width, canvas.height)

		// Draw the image
		const imgWidth = image.width * zoom
		const imgHeight = image.height * zoom

		ctx.save()
		ctx.translate(position.x, position.y)
		ctx.drawImage(image, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight)
		ctx.restore()
	}, [dimensions.width, dimensions.height, image, zoom, position.x, position.y])

	// Update the high-resolution canvas for download
	const updateHighResCanvas = useCallback(() => {
		if (!highResCanvasRef.current || dimensions.width === 0 || !image) return

		const canvas = highResCanvasRef.current
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const { widthMm, heightMm } = getDimensionsInMm()

		// Calculate high-resolution dimensions
		const highResWidth = Math.round(
			widthMm * MM_TO_INCH * PX_PER_INCH * RESOLUTION_MULTIPLIER
		)
		const highResHeight = Math.round(
			heightMm * MM_TO_INCH * PX_PER_INCH * RESOLUTION_MULTIPLIER
		)

		// Set canvas dimensions
		canvas.width = highResWidth
		canvas.height = highResHeight

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height)

		// Draw background
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, canvas.width, canvas.height)

		// Calculate scale factor between display and high-res
		const scaleFactor = highResWidth / dimensions.width

		// Draw the image at high resolution
		const imgWidth = image.width * zoom * scaleFactor
		const imgHeight = image.height * zoom * scaleFactor

		ctx.save()
		ctx.translate(position.x * scaleFactor, position.y * scaleFactor)
		ctx.drawImage(image, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight)
		ctx.restore()
	}, [dimensions.width, getDimensionsInMm, image, zoom, position.x, position.y])

	// Convert from mm to the current unit
	const convertFromMm = (valueMm: number): number => {
		if (units === 'cm') return valueMm * MM_TO_CM
		if (units === 'in') return valueMm * MM_TO_INCH
		return valueMm
	}

	// Handle dimension input changes
	const handleDimensionChange = (
		value: string,
		setter: React.Dispatch<React.SetStateAction<number>>,
		inputSetter: React.Dispatch<React.SetStateAction<string>>
	) => {
		// Update the input field state
		inputSetter(value)

		// If empty or invalid, don't update the actual dimension
		if (value === '' || value === '-') {
			return
		}

		const numValue = Number.parseFloat(value)
		if (!isNaN(numValue) && numValue > 0) {
			setter(numValue)
		}
	}

	// Update input states when units change
	useEffect(() => {
		setTemplateWidthInput(templateWidth.toString())
		setTemplateHeightInput(templateHeight.toString())
		setMinFaceHeightInput(minFaceHeight.toString())
		setMaxFaceHeightInput(maxFaceHeight.toString())
	}, [templateWidth, templateHeight, minFaceHeight, maxFaceHeight, units])

	// Reset to default dimensions
	const resetToDefaults = () => {
		if (units === 'mm') {
			setTemplateWidth(DEFAULT_TEMPLATE_WIDTH_MM)
			setTemplateHeight(DEFAULT_TEMPLATE_HEIGHT_MM)
			setMinFaceHeight(DEFAULT_MIN_FACE_HEIGHT_MM)
			setMaxFaceHeight(DEFAULT_MAX_FACE_HEIGHT_MM)
		} else if (units === 'cm') {
			setTemplateWidth(DEFAULT_TEMPLATE_WIDTH_MM * MM_TO_CM)
			setTemplateHeight(DEFAULT_TEMPLATE_HEIGHT_MM * MM_TO_CM)
			setMinFaceHeight(DEFAULT_MIN_FACE_HEIGHT_MM * MM_TO_CM)
			setMaxFaceHeight(DEFAULT_MAX_FACE_HEIGHT_MM * MM_TO_CM)
		} else if (units === 'in') {
			setTemplateWidth(DEFAULT_TEMPLATE_WIDTH_MM * MM_TO_INCH)
			setTemplateHeight(DEFAULT_TEMPLATE_HEIGHT_MM * MM_TO_INCH)
			setMinFaceHeight(DEFAULT_MIN_FACE_HEIGHT_MM * MM_TO_INCH)
			setMaxFaceHeight(DEFAULT_MAX_FACE_HEIGHT_MM * MM_TO_INCH)
		}

		// Also update the input fields
		setTemplateWidthInput(templateWidth.toString())
		setTemplateHeightInput(templateHeight.toString())
		setMinFaceHeightInput(minFaceHeight.toString())
		setMaxFaceHeightInput(maxFaceHeight.toString())
	}

	// Handle unit change
	const handleUnitChange = (newUnit: UnitType) => {
		const currentDimensions = getDimensionsInMm()

		setUnits(newUnit)

		// Convert all dimensions to the new unit
		setTemplateWidth(convertFromMm(currentDimensions.widthMm))
		setTemplateHeight(convertFromMm(currentDimensions.heightMm))
		setMinFaceHeight(convertFromMm(currentDimensions.minFaceMm))
		setMaxFaceHeight(convertFromMm(currentDimensions.maxFaceMm))
	}

	// Calculate canvas dimensions based on the template
	useEffect(() => {
		const calculateDimensions = () => {
			const { widthMm, heightMm } = getDimensionsInMm()

			const containerWidth = isMobile
				? Math.min(window.innerWidth - 32, 300)
				: 300
			const scale = containerWidth / (widthMm * MM_TO_INCH * PX_PER_INCH)

			const width = widthMm * MM_TO_INCH * PX_PER_INCH * scale
			const height = heightMm * MM_TO_INCH * PX_PER_INCH * scale

			setDimensions({ width, height, scale })
		}

		calculateDimensions()
		window.addEventListener('resize', calculateDimensions)

		return () => {
			window.removeEventListener('resize', calculateDimensions)
		}
	}, [isMobile, templateWidth, templateHeight, units, getDimensionsInMm])

	// Draw the canvas whenever relevant state changes
	useEffect(() => {
		if (!canvasRef.current || dimensions.width === 0) return

		const canvas = canvasRef.current
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		// Set canvas dimensions
		canvas.width = dimensions.width
		canvas.height = dimensions.height

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height)

		// Draw background
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, canvas.width, canvas.height)

		// Draw the image if available
		if (image) {
			const imgWidth = image.width * zoom
			const imgHeight = image.height * zoom

			ctx.save()
			ctx.translate(position.x, position.y)
			ctx.drawImage(image, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight)
			ctx.restore()
		}

		// Draw the template guides
		drawTemplateGuides(ctx)

		// Update the preview canvas
		updatePreviewCanvas()

		// Update the high-resolution canvas
		updateHighResCanvas()
	}, [
		image,
		zoom,
		position,
		dimensions,
		minFaceHeight,
		maxFaceHeight,
		units,
		drawTemplateGuides,
		updatePreviewCanvas,
		updateHighResCanvas,
	])

	// Handle file upload
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		const reader = new FileReader()
		reader.onload = (event) => {
			const img = new Image()
			img.onload = () => {
				setImage(img)

				// Calculate a zoom level that fits the image within the frame
				// with some padding (0.9 = 90% of the available space)
				const widthRatio = (dimensions.width * 0.9) / img.width
				const heightRatio = (dimensions.height * 0.9) / img.height
				const initialZoom = Math.min(widthRatio, heightRatio)

				// Set zoom to fit the frame initially
				setZoom(initialZoom)

				// Center the image
				setPosition({
					x: dimensions.width / 2,
					y: dimensions.height / 2,
				})
			}
			img.src = event.target?.result as string
		}
		reader.readAsDataURL(file)
	}

	// Handle mouse/touch events for dragging
	const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!image) return

		setIsDragging(true)
		const rect = canvasRef.current?.getBoundingClientRect()
		if (rect) {
			setDragStart({
				x: e.clientX - position.x,
				y: e.clientY - position.y,
			})
		}
	}

	const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!isDragging || !image) return

		setPosition({
			x: e.clientX - dragStart.x,
			y: e.clientY - dragStart.y,
		})
	}

	const handleMouseUp = () => {
		setIsDragging(false)
	}

	// Handle touch events
	const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
		if (!image) return

		setIsDragging(true)
		const rect = canvasRef.current?.getBoundingClientRect()
		if (rect) {
			setDragStart({
				x: e.touches[0].clientX - position.x,
				y: e.touches[0].clientY - position.y,
			})
		}
	}

	const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
		if (!isDragging || !image) return

		setPosition({
			x: e.touches[0].clientX - dragStart.x,
			y: e.touches[0].clientY - position.y,
		})
	}

	const handleTouchEnd = () => {
		setIsDragging(false)
	}

	// Handle zoom
	const handleZoomChange = (value: number[]) => {
		// Get the fit-to-frame zoom level for reference
		if (!image) return
		const widthRatio = (dimensions.width * 0.9) / image.width
		const heightRatio = (dimensions.height * 0.9) / image.height
		const fitZoom = Math.min(widthRatio, heightRatio)

		// Scale from fitZoom (at slider 0) to 5*fitZoom (at slider 1)
		const actualZoom = fitZoom * (1 + value[0] * 4)
		setZoom(actualZoom)
	}

	// Get slider value from actual zoom
	const getSliderValueFromZoom = (actualZoom: number) => {
		if (!image) return 0
		const widthRatio = (dimensions.width * 0.9) / image.width
		const heightRatio = (dimensions.height * 0.9) / image.height
		const fitZoom = Math.min(widthRatio, heightRatio)

		// Convert actual zoom back to slider value
		return Math.max(0, Math.min(1, (actualZoom / fitZoom - 1) / 4))
	}

	// Handle download
	const handleDownload = () => {
		if (!highResCanvasRef.current) return

		const link = document.createElement('a')
		link.download = 'id-photo.png'
		link.href = highResCanvasRef.current.toDataURL('image/png')
		link.click()
	}

	// Reset the editor
	const handleReset = () => {
		setImage(null)
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
		}
	}

	// Calculate actual physical dimensions
	const getPhysicalDimensions = () => {
		const { widthMm, heightMm } = getDimensionsInMm()

		const widthPx = Math.round(widthMm * MM_TO_INCH * PX_PER_INCH)
		const heightPx = Math.round(heightMm * MM_TO_INCH * PX_PER_INCH)
		const highResWidthPx = widthPx * RESOLUTION_MULTIPLIER
		const highResHeightPx = heightPx * RESOLUTION_MULTIPLIER

		return {
			widthPx,
			heightPx,
			highResWidthPx,
			highResHeightPx,
			widthMm,
			heightMm,
			widthIn: (widthMm * MM_TO_INCH).toFixed(2),
			heightIn: (heightMm * MM_TO_INCH).toFixed(2),
			widthCm: (widthMm * MM_TO_CM).toFixed(1),
			heightCm: (heightMm * MM_TO_CM).toFixed(1),
		}
	}

	const physicalDimensions = getPhysicalDimensions()

	return (
		<div className='grid gap-6 md:gap-8'>
			<div className='grid md:grid-cols-2 gap-6'>
				{/* Editor with guidelines */}
				<Card>
					<CardContent className='p-4'>
						<h2 className='text-lg font-semibold mb-3'>Edit Photo</h2>
						<div
							className='relative border rounded-lg overflow-hidden bg-white mx-auto'
							style={{ width: dimensions.width, height: dimensions.height }}
						>
							<canvas
								ref={canvasRef}
								className={`${image ? 'cursor-move' : ''}`}
								onMouseDown={handleMouseDown}
								onMouseMove={handleMouseMove}
								onMouseUp={handleMouseUp}
								onMouseLeave={handleMouseUp}
								onTouchStart={handleTouchStart}
								onTouchMove={handleTouchMove}
								onTouchEnd={handleTouchEnd}
								width={dimensions.width}
								height={dimensions.height}
							/>
						</div>
						{image && (
							<p className='text-sm text-center text-gray-500 mt-2'>
								Drag to position your face within the oval guide
							</p>
						)}
					</CardContent>
				</Card>

				{/* Preview without guidelines */}
				<Card>
					<CardContent className='p-4'>
						<h2 className='text-lg font-semibold mb-3'>Final Preview</h2>
						<div
							className='relative border rounded-lg overflow-hidden bg-white mx-auto'
							style={{ width: dimensions.width, height: dimensions.height }}
						>
							<canvas
								ref={previewCanvasRef}
								width={dimensions.width}
								height={dimensions.height}
							/>
							{!image && (
								<div className='absolute inset-0 flex items-center justify-center text-gray-400 text-sm text-center p-4'>
									Upload a photo to see the preview
								</div>
							)}
						</div>
						{image && (
							<p className='text-sm text-center text-gray-500 mt-2'>
								This is how your final photo will look
							</p>
						)}
					</CardContent>
				</Card>
			</div>

			<div className='grid gap-4'>
				<div className='flex flex-wrap gap-4 justify-center'>
					<Button
						onClick={() => fileInputRef.current?.click()}
						className='flex items-center gap-2'
					>
						<Upload size={16} />
						{image ? 'Change Photo' : 'Upload Photo'}
					</Button>

					{image && (
						<>
							<Button
								onClick={handleDownload}
								className='flex items-center gap-2'
							>
								<Download size={16} />
								Download High-Res
							</Button>

							<Button
								variant='outline'
								onClick={handleReset}
								className='flex items-center gap-2'
							>
								<RefreshCw size={16} />
								Reset
							</Button>
						</>
					)}

					<input
						type='file'
						ref={fileInputRef}
						onChange={handleFileChange}
						accept='image/*'
						className='hidden'
					/>
				</div>

				{image && (
					<div className='grid gap-2'>
						<div className='flex items-center gap-2'>
							<ZoomOut size={16} />
							<Slider
								value={[getSliderValueFromZoom(zoom)]}
								min={0}
								max={1}
								step={0.01}
								onValueChange={handleZoomChange}
							/>
							<ZoomIn size={16} />
						</div>
						<div className='flex justify-center'>
							<p className='text-xs text-gray-500 mr-2'>
								Zoom: {(zoom * 100).toFixed(0)}%
							</p>
							<Button
								variant='outline'
								size='sm'
								className='text-xs h-6 px-2'
								onClick={() => {
									if (!image) return
									const widthRatio = (dimensions.width * 0.9) / image.width
									const heightRatio = (dimensions.height * 0.9) / image.height
									const fitZoom = Math.min(widthRatio, heightRatio)
									setZoom(fitZoom)
								}}
							>
								Fit to Frame
							</Button>
						</div>
					</div>
				)}

				{/* Custom Dimensions Settings */}
				<Card>
					<CardContent className='p-4'>
						<div className='flex justify-between items-center mb-4'>
							<h3 className='font-medium'>Photo Dimensions</h3>
							<Button
								variant='ghost'
								size='sm'
								className='h-8 px-2'
								onClick={() => setShowSettings(!showSettings)}
							>
								<Settings size={16} className='mr-1' />
								{showSettings ? (
									<ChevronUp size={16} />
								) : (
									<ChevronDown size={16} />
								)}
							</Button>
						</div>

						{showSettings ? (
							<div className='grid gap-4'>
								<div className='flex justify-end'>
									<RadioGroup
										value={units}
										onValueChange={(value) =>
											handleUnitChange(value as UnitType)
										}
										className='flex space-x-2'
									>
										<div className='flex items-center space-x-1'>
											<RadioGroupItem value='mm' id='mm' />
											<Label htmlFor='mm'>mm</Label>
										</div>
										<div className='flex items-center space-x-1'>
											<RadioGroupItem value='cm' id='cm' />
											<Label htmlFor='cm'>cm</Label>
										</div>
										<div className='flex items-center space-x-1'>
											<RadioGroupItem value='in' id='in' />
											<Label htmlFor='in'>inches</Label>
										</div>
									</RadioGroup>
								</div>

								<div className='grid grid-cols-2 gap-4'>
									<div>
										<Label htmlFor='photo-width'>Photo Width</Label>
										<div className='flex items-center mt-1'>
											<Input
												id='photo-width'
												type='text'
												inputMode='decimal'
												pattern='[0-9]*\.?[0-9]*'
												min='0.1'
												step='0.1'
												value={templateWidthInput}
												className='min-w-0'
												onChange={(e) =>
													handleDimensionChange(
														e.target.value,
														setTemplateWidth,
														setTemplateWidthInput
													)
												}
												onBlur={(e) => {
													if (e.target.value === '' || e.target.value === '-') {
														setTemplateWidthInput(templateWidth.toString())
													}
												}}
											/>
											<span className='ml-2 w-8'>{units}</span>
										</div>
									</div>

									<div>
										<Label htmlFor='photo-height'>Photo Height</Label>
										<div className='flex items-center mt-1'>
											<Input
												id='photo-height'
												type='text'
												inputMode='decimal'
												pattern='[0-9]*\.?[0-9]*'
												min='0.1'
												step='0.1'
												value={templateHeightInput}
												className='min-w-0'
												onChange={(e) =>
													handleDimensionChange(
														e.target.value,
														setTemplateHeight,
														setTemplateHeightInput
													)
												}
												onBlur={(e) => {
													if (e.target.value === '' || e.target.value === '-') {
														setTemplateHeightInput(templateHeight.toString())
													}
												}}
											/>
											<span className='ml-2 w-8'>{units}</span>
										</div>
									</div>

									<div>
										<Label htmlFor='min-face'>Min Face Height</Label>
										<div className='flex items-center mt-1'>
											<Input
												id='min-face'
												type='text'
												inputMode='decimal'
												pattern='[0-9]*\.?[0-9]*'
												min='0.1'
												step='0.1'
												value={minFaceHeightInput}
												className='min-w-0'
												onChange={(e) =>
													handleDimensionChange(
														e.target.value,
														setMinFaceHeight,
														setMinFaceHeightInput
													)
												}
												onBlur={(e) => {
													if (e.target.value === '' || e.target.value === '-') {
														setMinFaceHeightInput(minFaceHeight.toString())
													}
												}}
											/>
											<span className='ml-2 w-8'>{units}</span>
										</div>
									</div>

									<div>
										<Label htmlFor='max-face'>Max Face Height</Label>
										<div className='flex items-center mt-1'>
											<Input
												id='max-face'
												type='text'
												inputMode='decimal'
												pattern='[0-9]*\.?[0-9]*'
												min='0.1'
												step='0.1'
												value={maxFaceHeightInput}
												className='min-w-0'
												onChange={(e) =>
													handleDimensionChange(
														e.target.value,
														setMaxFaceHeight,
														setMaxFaceHeightInput
													)
												}
												onBlur={(e) => {
													if (e.target.value === '' || e.target.value === '-') {
														setMaxFaceHeightInput(maxFaceHeight.toString())
													}
												}}
											/>
											<span className='ml-2 w-8'>{units}</span>
										</div>
									</div>
								</div>

								<Button
									variant='outline'
									size='sm'
									onClick={resetToDefaults}
									className='w-full mt-2'
								>
									Reset to Default Dimensions
								</Button>
							</div>
						) : (
							<ul className='space-y-1 text-sm'>
								<li>
									<strong>Photo size:</strong> {templateWidth.toFixed(1)}
									{units} × {templateHeight.toFixed(1)}
									{units}
								</li>
								<li>
									<strong>Face height:</strong> {minFaceHeight.toFixed(1)}
									{units} - {maxFaceHeight.toFixed(1)}
									{units}
								</li>
								<li>
									<strong>Standard resolution:</strong>{' '}
									{physicalDimensions.widthPx}px × {physicalDimensions.heightPx}
									px
								</li>
								<li>
									<strong>Download resolution:</strong>{' '}
									{physicalDimensions.highResWidthPx}px ×{' '}
									{physicalDimensions.highResHeightPx}px (
									{RESOLUTION_MULTIPLIER}x)
								</li>
							</ul>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Hidden high-resolution canvas for download */}
			<canvas ref={highResCanvasRef} className='hidden' />
		</div>
	)
}

export default function Home() {
	return (
		<main className='min-h-screen p-4 md:p-8 bg-gray-50'>
			<div className='max-w-4xl mx-auto'>
				<h1 className='text-2xl md:text-3xl font-bold text-center mb-4'>
					Photo ID Template Tool
				</h1>
				<p className='text-center mb-8 text-gray-600 max-w-2xl mx-auto'>
					Upload your portrait photo, position your face within the guidelines,
					and download a high-resolution ID
				</p>
				<PhotoEditor />
			</div>
		</main>
	)
}
