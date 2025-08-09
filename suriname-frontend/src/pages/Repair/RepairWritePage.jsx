import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SidebarNavigation from '../../components/SidebarNavigation';
import styles from '../../css/Repair/RepairWrite.module.css';
import { X } from 'lucide-react';
import axios from '../../api/axiosInstance'
import CategoryPresetPicker from '../../components/repairpreset/CategoryPresetPicker';

const RepairWritePage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const editMode = location.state?.mode === 'edit';
  const existingQuote = location.state?.quote;

  const [formData, setFormData] = useState({
    customerName: '',
    requestNo: '',
    engineerName: '',
    productName: '',
    customerConsent: false,
    statusChange: 'IN_PROGRESS',
    createdDate: new Date().toISOString().split('T')[0],
  });

  const [repairItems, setRepairItems] = useState([]);
  const [directInputItems, setDirectInputItems] = useState([
    {
      id: `initial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      itemName: '',
      description: '',
      cost: '',
      isEditing: true,
    },
  ]);

  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [estimatedCost, setEstimatedCost] = useState(0);
  const [actualCost, setActualCost] = useState(0);
  const [isActualCostManuallyEdited, setIsActualCostManuallyEdited] = useState(false);

  const statusOptions = [
    { value: 'IN_PROGRESS', label: '수리중' },
    { value: 'AWAITING_PAYMENT', label: '입금 대기' },
    { value: 'READY_FOR_DELIVERY', label: '배송 대기' },
    { value: 'COMPLETED', label: '완료' },
  ];

  useEffect(() => {
    if (editMode && existingQuote) {
      const engineerName = existingQuote.employeeName;
      const shouldClearEngineer =
        !engineerName ||
        engineerName.trim() === '' ||
        engineerName.includes('담당자 미지정') ||
        engineerName.includes('미지정') ||
        engineerName === 'null' ||
        engineerName === 'undefined';

      setFormData({
        customerName: existingQuote.customerName || '',
        requestNo: existingQuote.requestNo || '',
        engineerName: shouldClearEngineer ? '' : engineerName,
        productName: existingQuote.productName || '',
        customerConsent: existingQuote.isApproved || false,
        statusChange: 'IN_PROGRESS',
        createdDate: existingQuote.createdAt
          ? existingQuote.createdAt.split('T')[0]
          : new Date().toISOString().split('T')[0],
      });

      if (existingQuote.cost !== undefined && existingQuote.cost !== null) {
        setActualCost(existingQuote.cost);
      }

      if (existingQuote.field) {
        try {
          const fieldLines = existingQuote.field.split('\n');
          const repairItemLines = fieldLines.filter((line) => line.startsWith('- '));
          const parsedItems =
            repairItemLines
              .map((line, index) => {
                const match = line.match(/^- (.+?): (.+?) \((\d+)원\)$/);
                if (match) {
                  return {
                    id: `parsed_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                    itemName: match[1],
                    description: match[2],
                    cost: parseInt(match[3]),
                    isPreset: false,
                  };
                }
                return null;
              })
              .filter(Boolean) ?? [];

          if (parsedItems.length > 0) {
            setDirectInputItems([
              ...parsedItems.map((item) => ({ ...item, isEditing: false })),
              {
                id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                itemName: '',
                description: '',
                cost: '',
                isEditing: true,
              },
            ]);
          }
        } catch (error) {
          console.error('견적서 데이터 파싱 실패:', error);
        }
      }

      if (existingQuote.requestId) {
        loadExistingImages(existingQuote.requestId);
      } else {
        console.warn('Quote에서 requestId를 찾을 수 없습니다:', existingQuote);
      }
    }
  }, [editMode, existingQuote]);

  useEffect(() => {
    const repairTotal = repairItems.reduce((sum, item) => {
      const cost = parseInt(item.cost || 0);
      return sum + (isNaN(cost) ? 0 : cost);
    }, 0);

    const directTotal = directInputItems
      .filter((item) => !item.isEditing && item.cost && item.cost !== '')
      .reduce((sum, item) => {
        const cost = parseInt(item.cost || 0);
        return sum + (isNaN(cost) ? 0 : cost);
      }, 0);

    const total = repairTotal + directTotal;
    setEstimatedCost(total);
    if (!isActualCostManuallyEdited) setActualCost(total);
  }, [repairItems, directInputItems, isActualCostManuallyEdited]);

  const loadExistingImages = async (requestId) => {
    try {
      const response = await axios.get(`/api/images/request/${requestId}`);
      if (response.data.status === 200) {
        setUploadedImages(response.data.data);
      }
    } catch (error) {
      console.error('기존 이미지 로드 실패:', error);
    }
  };

  const uploadTempImages = async (requestNo) => {
    const tempImages = uploadedImages.filter((img) => img.file);
    if (tempImages.length === 0) return;

    try {
      const requestResponse = await axios.get(`/api/requests/requestid/${encodeURIComponent(requestNo)}`);
      if (requestResponse.data.status !== 200) throw new Error('Request ID를 찾을 수 없습니다.');
      const requestId = requestResponse.data.data.requestId;

      const successfulUploads = [];
      for (const tempImage of tempImages) {
        try {
          const formData = new FormData();
          formData.append('file', tempImage.file);
          const uploadResponse = await axios.post(`/api/images/upload/${requestId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (uploadResponse.data.status === 201) {
            const imageResponse = await axios.get(`/api/images/request/${requestId}`);
            if (imageResponse.data.status === 200) {
              const newImage = imageResponse.data.data.find((img) => img.imageId === uploadResponse.data.data.imageId);
              if (newImage) successfulUploads.push(newImage);
            }
          }
        } catch (error) {
          console.error(`이미지 업로드 실패: ${tempImage.fileName}`, error);
        }
      }

      setUploadedImages((prev) => [...prev.filter((img) => !img.file), ...successfulUploads]);
      tempImages.forEach((img) => img.url && URL.revokeObjectURL(img.url));
    } catch (error) {
      console.error('임시 이미지 업로드 처리 실패:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const imageFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) return false;
      const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      return allowed.some((ext) => file.name.toLowerCase().endsWith(ext));
    });

    if (imageFiles.length === 0) {
      alert('이미지 파일만 업로드 가능합니다.\n지원 형식: JPG, JPEG, PNG, GIF, BMP, WebP');
      return;
    }
    if (imageFiles.length < files.length) {
      const skipped = files.length - imageFiles.length;
      alert(`${skipped}개의 파일이 이미지 파일이 아니어서 제외되었습니다.\n${imageFiles.length}개의 이미지 파일만 업로드합니다.`);
    }

    if (editMode && existingQuote?.requestId) {
      setUploading(true);
      try {
        const requestId = existingQuote.requestId;
        const successfulUploads = [];
        for (const file of imageFiles) {
          if (file.size > 10 * 1024 * 1024) {
            alert(`${file.name}의 크기가 10MB를 초과합니다.`);
            continue;
          }
          try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await axios.post(`/api/images/upload/${requestId}`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (response.data.status === 201) {
              const imageResponse = await axios.get(`/api/images/request/${requestId}`);
              if (imageResponse.data.status === 200) {
                const newImage = imageResponse.data.data.find((img) => img.imageId === response.data.data.imageId);
                if (newImage) successfulUploads.push(newImage);
              }
            }
          } catch (error) {
            console.error(`파일 업로드 실패: ${file.name}`, error);
            let msg = `${file.name} 업로드에 실패했습니다.`;
            if (error.response?.data?.message) msg += `\n오류: ${error.response.data.message}`;
            else if (error.message) msg += `\n오류: ${error.message}`;
            if (error.response?.status === 400) {
              msg += `\n\n가능한 원인:
              - 이미지 파일이 아닌 파일을 업로드함
              - 파일 크기가 10MB를 초과함
              - 수리 요청 정보가 올바르지 않음`;
            }
            alert(msg);
          }
        }
        if (successfulUploads.length > 0) {
          setUploadedImages((prev) => [...prev, ...successfulUploads]);
          alert(`${successfulUploads.length}개의 이미지가 성공적으로 업로드되었습니다.`);
        }
      } catch (error) {
        console.error('파일 업로드 처리 실패:', error);
        alert('파일 업로드 중 오류가 발생했습니다.');
      } finally {
        setUploading(false);
        event.target.value = '';
      }
    } else if (editMode && !existingQuote?.requestId) {
      console.error('Request ID가 없습니다:', existingQuote);
      alert('수리 요청 정보가 올바르지 않습니다. Request ID를 찾을 수 없습니다.\n페이지를 새로고침하거나 목록에서 다시 선택해주세요.');
    } else {
      setUploading(true);
      try {
        const tempFiles = [];
        for (const file of imageFiles) {
          if (file.size > 10 * 1024 * 1024) {
            alert(`${file.name}의 크기가 10MB를 초과합니다.`);
            continue;
          }
          tempFiles.push({
            id: Date.now() + Math.random(),
            imageId: Date.now() + Math.random(),
            fileName: file.name,
            name: file.name,
            file,
            size: file.size,
            type: file.type,
            url: URL.createObjectURL(file),
          });
        }
        setUploadedImages((prev) => [...prev, ...tempFiles]);
        if (tempFiles.length > 0) {
          alert(`${tempFiles.length}개의 이미지가 선택되었습니다. 견적서 저장 시 업로드됩니다.`);
        }
      } catch (error) {
        console.error('파일 처리 실패:', error);
        alert('파일 처리 중 오류가 발생했습니다.');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!confirm('이미지를 삭제하시겠습니까?')) return;

    const imageToRemove = uploadedImages.find((img) => img.imageId === imageId || img.id === imageId);

    if (imageToRemove && imageToRemove.imageId && !imageToRemove.file) {
      try {
        const response = await axios.delete(`/api/images/${imageToRemove.imageId}`);
        if (response.data.status === 200) {
          setUploadedImages((prev) => prev.filter((img) => img.imageId !== imageId));
          alert('이미지가 삭제되었습니다.');
        }
      } catch (error) {
        console.error('이미지 삭제 실패:', error);
        alert('이미지 삭제에 실패했습니다.');
      }
    } else {
      setUploadedImages((prev) => {
        const tempImage = prev.find((img) => img.imageId === imageId || img.id === imageId);
        if (tempImage?.url) URL.revokeObjectURL(tempImage.url);
        return prev.filter((img) => img.imageId !== imageId && img.id !== imageId);
      });
    }
  };

  const validateField = async (field, value) => {
    if (!value) return false;
    try {
      let response;
      switch (field) {
        case 'customerName':
          response = await axios.get(`/api/customers/validate/name/${encodeURIComponent(value)}`);
          return response.data;
        case 'engineerName':
          response = await axios.get(`/api/users/validate/name/${encodeURIComponent(value)}`);
          return response.data;
        case 'requestNo':
          response = await axios.get(`/api/requests/validate/requestno/${encodeURIComponent(value)}`);
          return response.data;
        default:
          return true;
      }
    } catch (error) {
      console.error(`${field} 검증 실패:`, error);
      return false;
    }
  };

  const handleInputChange = async (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'customerConsent' && !value) next.engineerName = '';
      return next;
    });

    if (field === 'customerConsent' && value) {
      try {
        const response = await axios.get('/api/users/engineers?page=0&size=100');
        const engineers = response.data.content || [];
        if (engineers.length > 0) {
          const randomEngineer = engineers[Math.floor(Math.random() * engineers.length)];
          setFormData((prev) => ({ ...prev, customerConsent: value, engineerName: randomEngineer.name }));
        } else {
          console.warn('배정 가능한 수리기사가 없습니다.');
        }
      } catch (error) {
        console.error('수리기사 목록 조회 실패:', error);
      }
    }
  };

  const handleDirectInputChange = (id, field, value) => {
    setDirectInputItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const addDirectInputItem = () => {
    setDirectInputItems((prev) => [
      ...prev,
      {
        id: `direct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        itemName: '',
        description: '',
        cost: '',
        isEditing: true,
      },
    ]);
  };

  const confirmDirectInputItem = (id) => {
    const item = directInputItems.find((i) => i.id === id);
    if (item && item.itemName && item.description && item.cost) {
      setDirectInputItems((prev) => prev.map((i) => (i.id === id ? { ...i, isEditing: false } : i)));
    }
  };

  const removeDirectInputItem = (id) => setDirectInputItems((prev) => prev.filter((item) => item.id !== id));
  const removeRepairItem = (id) => setRepairItems((prev) => prev.filter((item) => item.id !== id));

  const handleSubmit = async () => {
    const required = ['customerName', 'requestNo', 'productName'];
    for (const f of required) {
      if (!formData[f]) {
        alert(`${f === 'customerName' ? '고객명' : f === 'requestNo' ? '접수번호' : '제품명'}을 입력해주세요.`);
        return;
      }
    }

    if (formData.customerConsent && !formData.engineerName.trim()) {
      if (!confirm('수리기사가 지정되지 않았습니다. 자동으로 배정하시겠습니까?')) return;
    }

    const hasEngineerName = formData.engineerName && formData.engineerName.trim().length > 0;
    const validations = await Promise.all([
      validateField('customerName', formData.customerName),
      validateField('requestNo', formData.requestNo),
      hasEngineerName ? validateField('engineerName', formData.engineerName.trim()) : true,
    ]);

    if (!validations[0]) return alert('등록되지 않은 고객명입니다.');
    if (!validations[1]) return alert('존재하지 않는 접수번호입니다.');
    if (hasEngineerName && !validations[2]) return alert('등록되지 않은 수리기사입니다.');

    const allRepairItems = [...repairItems, ...directInputItems.filter((item) => !item.isEditing && item.itemName)];
    if (allRepairItems.length === 0) return alert('최소 하나의 수리 항목을 추가해주세요.');

    try {
      const cleanEngineerName = formData.engineerName?.trim() ? formData.engineerName.trim() : null;
      const quoteData = {
        customerName: formData.customerName,
        requestNo: formData.requestNo,
        engineerName: formData.customerConsent ? cleanEngineerName : null,
        productName: formData.productName,
        customerConsent: formData.customerConsent,
        estimatedCost,
        actualCost,
        statusChange: formData.statusChange,
        repairItems: [
          ...repairItems.map((item) => ({
            itemName: item.itemName,
            description: item.description,
            cost: parseInt(item.cost) || 0,
            presetId: item.presetId || null,
          })),
          ...directInputItems
            .filter((item) => !item.isEditing && item.itemName)
            .map((item) => ({
              itemName: item.itemName,
              description: item.description,
              cost: parseInt(item.cost || 0),
              presetId: null,
            })),
        ],
      };

      let response;
      if (editMode && existingQuote) {
        const createResponse = await axios.post('/api/quotes', quoteData);
        if (createResponse.data.status === 201) {
          try {
            await axios.delete(`/api/quotes/${existingQuote.quoteId}`);
          } catch (e) {
            console.warn('기존 견적서 삭제 실패(무시):', e);
          }
          response = createResponse;
        } else {
          throw new Error('견적서 생성 실패');
        }
      } else {
        response = await axios.post('/api/quotes', quoteData);
      }

      if (response.data.status === 200 || response.data.status === 201) {
        if (!editMode && uploadedImages.some((img) => img.file)) {
          await uploadTempImages(formData.requestNo);
        }
        alert(editMode ? '견적서가 성공적으로 수정되었습니다.' : '견적서가 성공적으로 생성되었습니다.');
        navigate('/repair/list');
      }
    } catch (error) {
      console.error('견적서 저장 실패:', error);
      if (error.response?.data?.message) alert(error.response.data.message);
      else if (error.response?.status === 405) alert('서버에서 해당 요청 방식을 지원하지 않습니다. 관리자에게 문의하세요.');
      else alert('견적서 저장 중 오류가 발생했습니다.');
    }
  };

  const handleCancel = () => {
    if (confirm('작성 중인 내용이 저장되지 않습니다. 취소하시겠습니까?')) navigate(-1);
  };

  return (
    <div className={styles.customerContainer}>
      <SidebarNavigation />

      <div className={styles.tabNavigation}>
        <div className={styles.tabContainer}>
          <button className={`${styles.tabButton} ${styles.active}`}>
            {editMode ? '수리 내역 수정' : '수리 내역 작성'}
          </button>
        </div>
      </div>

      <div className={styles.sectionContainer}>
        <div className={styles.technicianSection}>
          <div className={styles.technicianBox}>
            <span className={styles.technicianLabel}>수리 기사</span>
            <input
              type="text"
              className={styles.technicianName}
              value={formData.engineerName}
              onChange={(e) => handleInputChange('engineerName', e.target.value)}
              placeholder={formData.customerConsent ? '수리기사명 입력 (비워두면 자동 배정)' : '고객 동의 시 수리기사 배정'}
              disabled={!formData.customerConsent}
              style={{ border: 'none', background: formData.customerConsent ? 'white' : '#f5f5f5', outline: 'none', padding: '4px 8px' }}
            />
          </div>
        </div>

        <div className={styles.sectionContent}>
          <div className={styles.inputGroup}>
            <div className={styles.inputField} style={{ flex: 1 }}>
              <label className={styles.inputLabel}>고객명</label>
              <input
                type="text"
                className={styles.inputControl}
                value={formData.customerName}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                placeholder="고객명을 입력하세요"
              />
            </div>
            <div className={styles.inputField} style={{ flex: 1 }}>
              <label className={styles.inputLabel}>제품명</label>
              <input
                type="text"
                className={styles.inputControl}
                value={formData.productName}
                onChange={(e) => handleInputChange('productName', e.target.value)}
                placeholder="제품명을 자유롭게 입력하세요"
              />
            </div>
            <div className={styles.inputField} style={{ flex: 1 }}>
              <label className={styles.inputLabel}>접수번호</label>
              <input
                type="text"
                className={styles.inputControl}
                value={formData.requestNo}
                onChange={(e) => handleInputChange('requestNo', e.target.value)}
                placeholder="접수번호를 입력하세요"
              />
            </div>
          </div>
        </div>

        <CategoryPresetPicker
          styles={styles}
          onAdd={(newItem) => setRepairItems((prev) => [...prev, newItem])}
        />

        {/* 수리 항목 */}
        <div className={styles.sectionContent}>
          <h2 className={styles.sectionTitle}>수리 항목</h2>
          <div className={styles.repairTable}>
            <div className={styles.tableHeader}>
              <div className={styles.headerCell}>수리 항목명</div>
              <div className={styles.headerCell}>설명</div>
              <div className={styles.headerCell}>비용</div>
              <div className={styles.headerCell}>+/-</div>
            </div>

            {repairItems.map((item) => (
              <div key={item.id} className={styles.tableRow}>
                <div className={styles.tableCell}>{item.itemName}</div>
                <div className={styles.tableCell}>{item.description}</div>
                <div className={styles.tableCell}>{item.cost?.toLocaleString()}원</div>
                <div className={styles.tableCell}>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => removeRepairItem(item.id)}
                    style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}

            {directInputItems.map((item, index) => (
              <div key={item.id} className={styles.tableRow}>
                <div className={styles.tableCell}>
                  {item.isEditing ? (
                    <input
                      className={styles.tableInput}
                      type="text"
                      placeholder="항목명 입력"
                      value={item.itemName}
                      onChange={(e) => handleDirectInputChange(item.id, 'itemName', e.target.value)}
                    />
                  ) : (
                    item.itemName
                  )}
                </div>
                <div className={styles.tableCell}>
                  {item.isEditing ? (
                    <input
                      className={styles.tableInput}
                      type="text"
                      placeholder="설명 입력"
                      value={item.description}
                      onChange={(e) => handleDirectInputChange(item.id, 'description', e.target.value)}
                    />
                  ) : (
                    item.description
                  )}
                </div>
                <div className={styles.tableCell}>
                  {item.isEditing ? (
                    <input
                      className={styles.tableInput}
                      type="number"
                      placeholder="비용 입력"
                      value={item.cost}
                      onChange={(e) => handleDirectInputChange(item.id, 'cost', e.target.value)}
                    />
                  ) : (
                    `${parseInt(item.cost || 0).toLocaleString()}원`
                  )}
                </div>
                <div className={styles.tableCell}>
                  {index === directInputItems.length - 1 ? (
                    <button
                      className={styles.addBtn}
                      onClick={() => {
                        if (item.isEditing) {
                          if (item.itemName && item.description && item.cost) {
                            confirmDirectInputItem(item.id);
                            addDirectInputItem();
                          } else {
                            alert('모든 필드를 입력해주세요.');
                          }
                        } else {
                          addDirectInputItem();
                        }
                      }}
                      style={{ backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}
                    >
                      +
                    </button>
                  ) : (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => removeDirectInputItem(item.id)}
                      style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>견적서 정보 입력</h2>
          <div className={styles.estimateGrid}>
            <div className={styles.estimateField}>
              <label className={styles.fieldLabel}>예상 총 견적금액</label>
              <input
                className={styles.fieldInput}
                type="text"
                value={estimatedCost.toLocaleString()}
                readOnly
                style={{ backgroundColor: '#f5f5f5' }}
                placeholder="200,000"
              />
              <small>* 수리 항목 비용의 합계가 자동으로 계산됩니다.</small>
            </div>
            <div className={styles.estimateField}>
              <label className={styles.fieldLabel}>견적서 생성일</label>
              <input
                className={styles.fieldInput}
                type="date"
                value={formData.createdDate}
                onChange={(e) => handleInputChange('createdDate', e.target.value)}
              />
            </div>
            <div className={styles.estimateField}>
              <label className={styles.fieldLabel}>실제 수리 비용</label>
              <input
                className={styles.fieldInput}
                type="number"
                value={actualCost}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value) || 0;
                  setActualCost(newValue);
                  setIsActualCostManuallyEdited(true);
                }}
                placeholder="180,000"
              />
            </div>
            <div className={styles.estimateField}>
              <label className={styles.fieldLabel}>상태 변경</label>
              <select
                className={styles.fieldInput}
                value={formData.statusChange}
                onChange={(e) => handleInputChange('statusChange', e.target.value)}
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.agreementSection}>
            <span className={styles.agreementLabel}>고객 동의 여부</span>
            <div className={styles.checkbox}>
              <input
                type="checkbox"
                checked={formData.customerConsent}
                onChange={(e) => handleInputChange('customerConsent', e.target.checked)}
              />
              <span>동의 받음</span>
            </div>
          </div>
        </div>

        <div className={styles.sectionContent}>
          <h2 className={styles.sectionTitle}>사진 첨부</h2>
          <div className={styles.fileUpload}>
            <p className={styles.fileInfo}>이미지 파일만 업로드 가능하며, 파일 크기는 10MB 이하로 제한됩니다.</p>

            <div className={styles.dropZone}>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className={styles.fileInput}
                disabled={uploading}
              />
              <div className={styles.dropText}>
                {uploading ? '이미지 업로드 중...' : '파일을 드롭하거나 클릭하여 선택'}
              </div>
              <div className={styles.formatText}>
                형식: JPG, PNG, GIF & 최대 파일 크기: 10MB
              </div>
            </div>

            {uploadedImages.length > 0 && (
              <div className={styles.uploadedFiles}>
                <h4>📷 업로드된 이미지 ({uploadedImages.length}장):</h4>
                <div className={styles.imageGallery}>
                  {uploadedImages.map((image) => (
                    <div key={image.imageId || image.id} className={styles.imageItem}>
                      <div className={styles.imagePreview}>
                        <img
                          src={image.url || (image.imageId ? `/api/images/view/${image.imageId}` : '')}
                          alt={image.fileName || image.name}
                          className={styles.previewImage}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className={styles.imagePlaceholder} style={{ display: 'none' }}>
                          <span>이미지를 불러올 수 없습니다</span>
                        </div>
                      </div>
                      <div className={styles.imageInfo}>
                        <div className={styles.imageName} title={image.fileName || image.name}>
                          {image.fileName || image.name}
                        </div>
                        <div className={styles.imageSize}>
                          {image.fileSize
                            ? `${(image.fileSize / 1024).toFixed(1)} KB`
                            : image.size
                            ? `${(image.size / 1024).toFixed(1)} KB`
                            : ''}
                        </div>
                      </div>
                      <button
                        className={styles.removeImageBtn}
                        onClick={() => handleDeleteImage(image.imageId || image.id)}
                        title="이미지 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.cancelButton} onClick={handleCancel}>
            취소
          </button>
          <button className={styles.submitButton} onClick={handleSubmit}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default RepairWritePage;
